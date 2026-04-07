---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - _bmad-output/planning-artifacts/prd-mobile.md
  - _bmad-output/planning-artifacts/architecture-mobile.md
  - _bmad-output/planning-artifacts/ux-design-specification-mobile.md
---

# TinSu Mobile - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for TinSu Mobile, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Founder can create a new remote connection by entering host, port, and username
FR2: Founder can generate an SSH key pair (Ed25519) on the device
FR3: Founder can view and copy the public key for adding to remote PC's authorized_keys
FR4: Founder can test a connection and see success/failure result
FR5: Founder can save connections with a display name for one-tap access
FR6: Founder can edit or delete saved connections
FR7: Founder can select between SSH and mosh transport for a connection
FR8: System stores SSH private keys in the device's secure keychain/keystore
FR9: System establishes SSH/mosh connection to the remote PC on founder's request
FR10: System discovers and lists TinSu projects on the remote machine
FR11: Founder can select a project to open from the discovered project list
FR12: System attaches to existing tmux sessions on the remote PC for the selected project
FR13: System detects and displays connection state (connected, reconnecting, disconnected, offline)
FR14: System automatically reconnects via mosh when network transitions occur (WiFi to cellular)
FR15: System buffers unsent messages during brief disconnections and delivers them on reconnect
FR16: Founder can view a list of active and previous chat sessions for the selected project
FR17: Founder can open an existing chat session and view the full message history
FR18: Founder can send a message to the agent in an active chat session
FR19: System delivers messages to the Claude Code CLI process running in the remote tmux session
FR20: System receives and displays agent responses in the chat UI as message bubbles
FR21: Founder can scroll through chat history within a session
FR22: Founder can start a new chat session with a selected agent persona (PM, Architect, Dev, etc.)
FR23: System displays session status indicators (thinking, idle, completed, exited) for each session
FR24: Founder can browse the planning documents directory on the remote project
FR25: Founder can open and read a markdown document with rendered formatting
FR26: System caches viewed documents for offline reading
FR27: Founder can search within a planning document
FR28: Founder can navigate between documents via internal links
FR29: Founder can view a list of implementation tasks with their current status
FR30: Founder can open a task in Review status and view the code diff
FR31: System displays diffs with syntax highlighting and line numbers
FR32: Founder can pinch-to-zoom on code diffs for readability
FR33: Founder can approve a reviewed task, triggering merge on the remote PC
FR34: Founder can request changes on a reviewed task with written feedback
FR35: Founder can reject a task with written feedback, returning it to In Progress
FR36: System displays the agent's reasoning log for a task
FR37: Founder can view a project overview showing active agent sessions, pending reviews, and recent activity
FR38: Founder can switch between project sections (Chat, Docs, Tasks) via bottom navigation
FR39: System displays a count of items requiring attention (pending reviews, active agents)
FR40: Founder can configure Termux integration on Android (Phase 2 — deferred)
FR41: System detects whether Termux and Node.js are installed (Phase 2 — deferred)
FR42: Founder can open a local project directory as a TinSu project (Phase 2 — deferred)
FR43: System runs Claude Code CLI locally within Termux for local projects (Phase 2 — deferred)
FR44: Founder can use the same agent chat, doc viewer, and code review UI for local projects (Phase 2 — deferred)
FR45: Founder can manage saved connections (add, edit, delete, reorder)
FR46: Founder can configure mosh settings (port range, prediction mode)
FR47: Founder can configure document cache size and clear cache
FR48: Founder can view app version and connection diagnostics

### NonFunctional Requirements

NFR1: SSH connection establishment completes in <5 seconds on stable network
NFR2: Mosh session handoff completes in <3 seconds after network transition
NFR3: Automatic reconnection after signal loss completes within 10 seconds of network availability
NFR4: App cold start to connection list screen in <2 seconds
NFR5: Navigation between sections (Chat, Docs, Tasks) completes in <200ms
NFR6: Chat message rendering (send to display) completes in <500ms after agent responds
NFR7: Code diff rendering for files up to 1000 lines completes in <1 second
NFR8: Pinch-to-zoom on diffs and documents responds at 60fps
NFR9: Document cache lookup completes in <100ms
NFR10: Project discovery on remote machine completes in <10 seconds for up to 20 projects
NFR11: Mosh sessions survive network transitions (WiFi to cellular) with zero message loss
NFR12: App recovers gracefully from SSH connection timeout without crashing
NFR13: Unsent messages are preserved across app backgrounding and delivered on reconnect
NFR14: Cached documents are validated against remote timestamps on reconnect
NFR15: SSH key storage uses platform secure enclave (Android Keystore / iOS Keychain)
NFR16: No user credentials are stored in plaintext at any point
NFR17: Remote tmux sessions are unaffected by mobile app crashes — session continues on PC
NFR18: App state (active project, active section, scroll position) is preserved across app backgrounding
NFR19: SSH implementation supports Ed25519, RSA (2048+), and ECDSA key types
NFR20: Mosh implementation supports UDP port range 60000-61000 (configurable)
NFR21: System works with OpenSSH 7.4+ on the remote PC
NFR22: Mobile app reads the same SQLite database and project file structure as the desktop app via SSH/SFTP
NFR23: Actions taken on mobile (approve, request changes) are reflected immediately on the desktop app's next refresh
NFR24: Termux integration works with Termux 0.118+ from F-Droid (Phase 2 — deferred)
NFR25: System detects Termux installation status and Node.js availability within 2 seconds (Phase 2 — deferred)
NFR26: Android app follows Material 3 design guidelines
NFR27: iOS app follows Human Interface Guidelines
NFR28: Both apps support dark mode and light mode
NFR29: Both apps support dynamic text sizing / accessibility font scaling
NFR30: Android app targets SDK 34 with minSdk 29
NFR31: iOS app supports iPhone SE (2nd gen) and larger screen sizes

### Additional Requirements

- **Starter Template:** JetBrains KMP Wizard — project initialization with shared logic + native UI is the first implementation story
- **SSH Libraries:** Apache MINA SSHD 2.x for Android, SwiftNIO SSH for iOS — platform-specific implementations via expect/actual
- **Mosh Libraries:** NDK-compiled mosh-client (Sonelli fork) for Android, Blink Shell mosh fork for iOS
- **Shared Logic Stack:** Ktor (networking), SQLDelight 2.2.1 (cache DB), Koin (DI), kotlinx.serialization, kotlinx.coroutines, kotlin-test
- **Project Structure:** Feature-based organization — shared/commonMain for business logic, androidApp for Compose UI, iosApp for SwiftUI
- **Data Architecture:** Mobile downloads desktop SQLite DB via SFTP; SQLDelight opens locally for type-safe queries; timestamp-based cache invalidation on reconnect
- **Remote Command Abstraction:** KMP expect class RemoteExecutor with exec, downloadFile, uploadFile, stat operations
- **tmux Session Naming Convention:** Must match desktop pattern `tinsu-{projectName}-{taskId}` for discovery and attachment
- **tmux Interaction Pattern:** Send via `tmux send-keys`, receive via `tmux capture-pane -p -S -500` polled at 1s interval
- **State Management:** Shared ViewModels expose StateFlow<UiState> with sealed class pattern (Loading/Success/Error) — never boolean flags
- **Error Handling:** Domain Result<T> sealed interface; AppError sealed interface with ConnectionFailed/Timeout/SyncFailed; no exceptions across module boundaries
- **Retry Pattern:** SSH exponential backoff (1s-30s, max 5 attempts), SFTP 3 retries with 1s delay, tmux no retry
- **Offline Queue:** Write operations (send message, approve task) queued locally in FIFO, flushed on reconnect
- **CI/CD:** GitHub Actions for both platforms; Fastlane for store deployment
- **MVP Platform Priority:** Android first, iOS follows — KMP shared logic means iOS is primarily a UI build
- **Local Cache Schema:** SQLDelight with mirrored desktop tables (tasks, sprints, epics, agent_runs, task_sessions, task_activities) + mobile-only tables (connections, document_cache, app_preferences, chat_cache)
- **Naming Conventions:** snake_case for DB (matching desktop), PascalCase for Kotlin/Swift types, camelCase for functions/properties, SCREAMING_SNAKE for constants
- **Android Navigation:** Navigation Compose 2.8+ with @Serializable routes and type-safe arguments
- **iOS Navigation:** NavigationStack + NavigationPath with Hashable destination enums
- **Deep Link Support:** tinsu://chat/{sessionId}, tinsu://task/{taskId}
- **Logging:** Platform expect/actual (Log.d on Android, os_log on iOS), format [TAG] message
- **Testing:** Co-located tests — shared in commonTest, Android in src/test, iOS in Tests/

### UX Design Requirements

UX-DR1: Implement "Industrial-Utilitarian Terminal Luxe" dark theme as default — #0D1117 background, #161B22 surface, #58A6FF primary accent, with complete dark and light color token sets as specified in UX spec
UX-DR2: Implement custom ChatBubble component — user bubbles (trailing-aligned, #1F3A5F), agent bubbles (leading-aligned, #161B22), with inline markdown rendering, code blocks (monospaced + surfaceVariant background + horizontal scroll + copy button), and sending/sent/failed states
UX-DR3: Implement ConnectionStatusBar component — always-visible in TopAppBar area, 4 states (Connected green/Reconnecting yellow pulsing/Disconnected red/Offline gray), tappable for connection details, 200ms color fade transitions
UX-DR4: Implement SessionStatusChip component — 5 states (Active green/Thinking yellow pulsing/Idle gray/Completed checkmark/Exited red), Material 3 AssistChip on Android, SF Symbol Label on iOS
UX-DR5: Implement DiffLine component — line number gutter (old + new) + code content in JetBrains Mono 13sp, addition/deletion backgrounds at 15% opacity, per-line horizontal scroll for long lines
UX-DR6: Implement DiffFileHeader component — collapsible file header with filename, change summary (+X/-Y), expand/collapse chevron; ElevatedCard on Android, DisclosureGroup on iOS
UX-DR7: Implement typography system — display/body text in Geist or IBM Plex Sans (Android) / SF Pro (iOS), code/diff in JetBrains Mono 13sp, all sizes support dynamic text scaling
UX-DR8: Implement 4dp-based spacing system — 16dp content margins, 16dp card padding, 12dp/8dp chat bubble padding, 48dp minimum touch targets (Android) / 44pt (iOS), 80dp bottom nav height
UX-DR9: Implement bottom navigation with 4 tabs — Chat, Docs, Tasks, Settings — with badge counts for pending items (FR38-FR39), Material 3 NavigationBar on Android, TabView on iOS
UX-DR10: Implement keyboard-aware chat input — expanding multi-line text field (up to 4 visible lines then scroll), send button, auto-scroll on keyboard appearance, no content jump or hidden input
UX-DR11: Implement agent response streaming — poll tmux capture-pane at 1s intervals, detect message boundaries, render incrementally into chat bubbles, show "Thinking" pulsing indicator during agent processing
UX-DR12: Implement pinch-to-zoom (1x-3x range) on code diffs and documents — detectTransformGestures on Android, MagnifyGesture on iOS, maintaining 60fps
UX-DR13: Implement haptic feedback patterns — light tap on message sent, medium impact on task approved, warning haptic on connection lost, error haptic on errors, success haptic on connection established
UX-DR14: Implement action hierarchy — primary (filled/FAB for Approve/Send/Connect), secondary (outlined for Request Changes/Edit), destructive (error-colored text for Reject/Delete), tertiary (plain text for Cancel/Dismiss)
UX-DR15: Implement offline mode UX — cached docs/chat/diffs remain readable, "Offline — cached data" banner, write operations queued with visual indicator, seamless transition when connectivity returns
UX-DR16: Implement connection list with saved connection cards — display name, host, last connected timestamp, status indicator dot, one-tap access pattern (inspired by Termius)
UX-DR17: Implement guided first-time SSH setup flow — step-by-step key generation, public key display with copy button, explicit authorized_keys command, mandatory test connection before save
UX-DR18: Implement diff color system — addition background (success at 15% opacity), deletion background (error at 15% opacity), +/- prefix in addition to color for accessibility
UX-DR19: Implement accessibility requirements — WCAG AA contrast (4.5:1 minimum), 48dp/44pt touch targets with 8dp spacing, screen reader labels for chat bubbles (sender + timestamp), connection status announced on change, diff lines labeled with line number and change type
UX-DR20: Implement review action UX — Approve is one tap + confirm dialog, Request Changes requires text feedback, Reject requires text + confirmation dialog, sticky bottom action bar on diff viewer
UX-DR21: Implement collapsible TopAppBar showing project name + connection status, collapsing on scroll to maximize content area
UX-DR22: Implement loading states — skeleton/shimmer on Android, ProgressView on iOS — never blank screens; pull-to-refresh on all data screens
UX-DR23: Implement session list cards — agent persona icon, last message preview, SessionStatusChip, timestamp; tappable to open full chat
UX-DR24: Implement task list with status filtering — Review items surfaced first with badge count, task cards showing status indicator and summary

### FR Coverage Map

FR1: Epic 2 — Create remote connection (host, port, username)
FR2: Epic 2 — Generate SSH key pair (Ed25519)
FR3: Epic 2 — View/copy public key
FR4: Epic 2 — Test connection
FR5: Epic 2 — Save connections with display name
FR6: Epic 2 — Edit/delete saved connections
FR7: Epic 2 — Select SSH/mosh transport
FR8: Epic 2 — Secure key storage (Keystore/Keychain)
FR9: Epic 2 — Establish SSH/mosh connection
FR10: Epic 2 — Discover projects on remote
FR11: Epic 2 — Select project from list
FR12: Epic 3 — Attach to tmux sessions
FR13: Epic 2 — Display connection state
FR14: Epic 7 — Auto-reconnect via mosh on network transition
FR15: Epic 7 — Buffer unsent messages during disconnections
FR16: Epic 3 — View chat session list
FR17: Epic 3 — Open chat session with full history
FR18: Epic 3 — Send message to agent
FR19: Epic 3 — Deliver messages to tmux session
FR20: Epic 3 — Display agent responses as chat bubbles
FR21: Epic 3 — Scroll chat history
FR22: Epic 3 — Start new chat session with agent persona
FR23: Epic 3 — Session status indicators
FR24: Epic 4 — Browse planning documents directory
FR25: Epic 4 — Read rendered markdown document
FR26: Epic 4 — Cache documents for offline reading
FR27: Epic 4 — Search within a document
FR28: Epic 4 — Navigate via internal links
FR29: Epic 5 — View task list with status
FR30: Epic 5 — Open task diff in Review status
FR31: Epic 5 — Diffs with syntax highlighting and line numbers
FR32: Epic 5 — Pinch-to-zoom on diffs
FR33: Epic 5 — Approve task (trigger merge)
FR34: Epic 5 — Request changes with feedback
FR35: Epic 5 — Reject task with feedback
FR36: Epic 5 — Agent reasoning log
FR37: Epic 6 — Project overview (sessions, reviews, activity)
FR38: Epic 6 — Bottom navigation switching (Chat, Docs, Tasks)
FR39: Epic 6 — Attention count badges
FR40-FR44: Deferred — Phase 2 Local Mode (Termux)
FR45: Epic 7 — Manage saved connections (add, edit, delete, reorder)
FR46: Epic 7 — Mosh settings (port range, prediction mode)
FR47: Epic 7 — Cache size configuration and clear cache
FR48: Epic 7 — App version and connection diagnostics

## Epic List

### Epic 1: Project Foundation & KMP Scaffold
Establish the KMP project structure, build tooling, shared infrastructure (DI, database, error types, logging), CI/CD pipelines, and the Terminal Luxe design system — enabling all subsequent feature development.
**FRs covered:** None directly (foundational architecture requirement)
**NFRs addressed:** NFR4, NFR26, NFR27, NFR28, NFR29, NFR30, NFR31
**UX-DRs addressed:** UX-DR1, UX-DR7, UX-DR8, UX-DR9, UX-DR14, UX-DR19, UX-DR21, UX-DR22

### Epic 2: Connect to Your PC
Founder can set up SSH keys, create and save connections, connect to their remote PC, and discover their TinSu projects — the complete first-time setup and one-tap reconnect experience.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR13
**NFRs addressed:** NFR1, NFR15, NFR16, NFR19, NFR21
**UX-DRs addressed:** UX-DR3, UX-DR16, UX-DR17

### Epic 3: Chat with Your Agents
Founder can open agent chat sessions, view conversation history, send messages, receive streaming responses, and start new sessions with specific agent personas — the core mobile interaction loop.
**FRs covered:** FR12, FR16, FR17, FR18, FR19, FR20, FR21, FR22, FR23
**NFRs addressed:** NFR5, NFR6, NFR17
**UX-DRs addressed:** UX-DR2, UX-DR4, UX-DR10, UX-DR11, UX-DR13, UX-DR23

### Epic 4: Read Planning Documents
Founder can browse, read, search, and navigate planning documents on their remote project with rendered markdown — and read cached docs offline.
**FRs covered:** FR24, FR25, FR26, FR27, FR28
**NFRs addressed:** NFR9, NFR14
**UX-DRs addressed:** UX-DR12, UX-DR15

### Epic 5: Review Code & Act on Tasks
Founder can view implementation tasks, read code diffs with syntax highlighting, and approve/request changes/reject tasks — completing the full review cycle from their phone.
**FRs covered:** FR29, FR30, FR31, FR32, FR33, FR34, FR35, FR36
**NFRs addressed:** NFR7, NFR8, NFR22, NFR23
**UX-DRs addressed:** UX-DR5, UX-DR6, UX-DR12, UX-DR18, UX-DR20, UX-DR24

### Epic 6: Project Dashboard & Status at a Glance
Founder sees a project overview with active sessions, pending reviews, and recent activity on one screen — the habit-forming "what happened since I left?" experience.
**FRs covered:** FR37, FR38, FR39
**NFRs addressed:** NFR5, NFR18
**UX-DRs addressed:** UX-DR9 (badge counts)

### Epic 7: Resilient Connections & Settings
Founder gets mosh-based resilient connections that survive network transitions, offline mode with queued operations, and configurable settings for mosh, cache, and diagnostics.
**FRs covered:** FR14, FR15, FR45, FR46, FR47, FR48
**NFRs addressed:** NFR2, NFR3, NFR11, NFR13, NFR20
**UX-DRs addressed:** UX-DR3 (reconnecting states), UX-DR13 (haptics), UX-DR15 (offline UX)

---

## Epic 1: Project Foundation & KMP Scaffold

Establish the KMP project structure, build tooling, shared infrastructure (DI, database, error types, logging), CI/CD pipelines, and the Terminal Luxe design system — enabling all subsequent feature development.

### Story 1.1: Initialize KMP Project with JetBrains Wizard

As a developer,
I want a properly structured KMP project with Android and iOS targets,
So that I have the foundation to build shared business logic and native UIs.

**Acceptance Criteria:**

**Given** the JetBrains KMP Wizard generates a project with Android + iOS targets and shared UI disabled
**When** the project is opened in Android Studio / Xcode
**Then** the project compiles successfully with Kotlin 2.1+ and K2 compiler
**And** the project structure contains shared/commonMain, shared/androidMain, shared/iosMain, androidApp, iosApp directories
**And** Gradle version catalog (libs.versions.toml) defines versions for Ktor, SQLDelight 2.2.1, Koin, kotlinx.serialization, kotlinx.coroutines, kotlin-test
**And** all core dependencies are resolved and the project builds without errors
**And** a minimal "Hello World" screen renders on both Android (Jetpack Compose) and iOS (SwiftUI)
**And** Android targets SDK 34 with minSdk 29 (NFR30)
**And** iOS deployment target supports iPhone SE 2nd gen+ (NFR31)

### Story 1.2: Implement Shared Infrastructure — DI, Error Types, and Logging

As a developer,
I want shared DI modules, domain error types, and platform-abstracted logging,
So that all future features use consistent patterns for dependency injection, error handling, and diagnostics.

**Acceptance Criteria:**

**Given** the KMP project from Story 1.1 is set up
**When** the shared infrastructure is implemented
**Then** Koin modules exist: SharedModule (commonMain), AndroidModule (androidMain), IosModule (iosMain)
**And** a `Result<T>` sealed interface with `Success<T>` and `Failure(AppError)` cases exists in shared/commonMain/util/
**And** an `AppError` sealed interface with `ConnectionFailed(reason)`, `Timeout(operation)`, `SyncFailed(reason)` cases exists
**And** an `expect` Logger class exists in commonMain with `actual` implementations: `android.util.Log` on Android, `os_log` on iOS
**And** logging format follows `[TAG] message` convention where TAG is the class name
**And** feature-based package structure is created: connection/, security/, chat/, documents/, review/, project/, sync/, db/, di/, util/
**And** unit tests verify Result<T> success and failure paths

### Story 1.3: Set Up SQLDelight Local Cache Schema

As a developer,
I want the complete SQLDelight database schema with mirrored desktop tables and mobile-only tables,
So that the app can cache remote data and store local preferences with type-safe queries.

**Acceptance Criteria:**

**Given** SQLDelight 2.2.1 is configured in the KMP shared module
**When** the database schema files are created
**Then** mirrored desktop tables exist: tasks, sprints, epics, agent_runs, task_sessions, task_activities — with snake_case naming matching desktop conventions
**And** mobile-only tables exist: connections, document_cache, chat_cache, app_preferences
**And** all tables use snake_case for table names and column names
**And** foreign keys follow `{referenced_table_singular}_id` convention
**And** date/time columns store INTEGER (Unix timestamp seconds)
**And** the database compiles and SQLDelight generates type-safe Kotlin query classes
**And** a basic integration test verifies insert and query operations on at least one table

### Story 1.4: Implement Terminal Luxe Design System — Android

🎨 **FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.**

As a founder,
I want the Android app to have the Industrial-Utilitarian Terminal Luxe dark theme,
So that the mobile experience feels like a refined control room matching my desktop workflow aesthetic.

**Acceptance Criteria:**

**Given** the Android app module with Jetpack Compose
**When** the Terminal Luxe theme is implemented
**Then** a custom Material 3 `ColorScheme` is defined with dark theme tokens: background #0D1117, surface #161B22, surfaceVariant #1C2128, primary #58A6FF, onBackground #E6EDF3, onSurface #C9D1D9, onSurfaceVariant #8B949E, success #3FB950, warning #D29922, error #F85149, outline #30363D, userBubble #1F3A5F, agentBubble #161B22
**And** light theme tokens are defined: background #FFFFFF, surface #F6F8FA, surfaceVariant #EFF1F3, primary #0969DA, onBackground #1F2328, onSurface #424A53, success #1A7F37, warning #9A6700, error #CF222E
**And** dynamic color is disabled — the Terminal Luxe palette is intentional
**And** typography system uses Geist or IBM Plex Sans for display/body text and JetBrains Mono (bundled TTF) for code, with sizes matching UX spec (28sp display, 22sp headline, 18sp title, 15sp body, 13sp label/code, 11sp line numbers)
**And** all text uses scalable sp units for accessibility font scaling (NFR29)
**And** a 4dp-based spacing system is established with 16dp content margins, 16dp card padding, 48dp minimum touch targets
**And** bottom `NavigationBar` with 4 tabs (Chat, Docs, Tasks, Settings) is implemented with `Badge` support for pending counts
**And** collapsible `MediumTopAppBar` pattern is implemented (collapses on scroll)
**And** action hierarchy button styles are defined: filled (primary), outlined (secondary), error-colored text (destructive), plain text (tertiary)
**And** skeleton/shimmer loading state composable is created for reuse across screens
**And** all text meets WCAG AA contrast ratio (4.5:1 minimum) (UX-DR19)
**And** a Compose Preview demonstrates the theme with sample components

### Story 1.5: Implement Terminal Luxe Design System — iOS

🎨 **FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.**

As a founder,
I want the iOS app to match the same Terminal Luxe aesthetic as Android,
So that the experience is consistent regardless of which phone I use.

**Acceptance Criteria:**

**Given** the iOS app module with SwiftUI
**When** the Terminal Luxe theme is implemented for iOS
**Then** custom color assets are defined in the asset catalog matching Android hex values exactly (dark and light variants)
**And** `.preferredColorScheme(.dark)` is set as default at the app root
**And** typography uses SF Pro Display/Text for display/body and SF Mono or JetBrains Mono for code, with sizes matching UX spec (28pt display, 22pt headline, 18pt title, 17pt body, 13pt label/code, 11pt line numbers)
**And** all text supports Dynamic Type for accessibility font scaling (NFR29)
**And** `TabView` with 4 tabs (Chat, Docs, Tasks, Settings) is implemented matching Android's information architecture
**And** `NavigationStack` with collapsible title behavior (`.navigationBarTitleDisplayMode(.large)` collapsing to `.inline` on scroll)
**And** action hierarchy ViewModifiers are defined: `.borderedProminent` (primary), `.bordered` (secondary), `.destructive` role (destructive), plain (tertiary)
**And** `ProgressView` loading state pattern is established
**And** SF Symbols with `.monochrome` rendering are used for icons
**And** subtle vibrancy effects on navigation bar background
**And** minimum touch targets are 44pt with 8dp spacing between targets (UX-DR19)
**And** a SwiftUI Preview demonstrates the theme with sample components

### Story 1.6: Configure CI/CD Pipelines

As a developer,
I want GitHub Actions workflows that validate every PR and automate store deployments,
So that code quality is enforced and releases are streamlined.

**Acceptance Criteria:**

**Given** the KMP project with Android and iOS modules
**When** CI/CD workflows are configured
**Then** `android-ci.yml` runs on PR: compiles Android module, runs unit tests, runs KtLint
**And** `ios-ci.yml` runs on PR: compiles iOS module, runs unit tests, runs SwiftLint
**And** `shared-tests.yml` runs on PR: compiles shared KMP module, runs commonTest suite
**And** `release.yml` is configured for Fastlane deployment: Android → signed AAB → Play Store, iOS → signed IPA → App Store
**And** KtLint is configured to enforce Kotlin naming conventions (PascalCase classes, camelCase functions, SCREAMING_SNAKE constants)
**And** SwiftLint is configured to enforce Swift naming conventions (PascalCase types, camelCase functions, PascalCase + View suffix for SwiftUI views)
**And** all three CI workflows pass on the current codebase

---

## Epic 2: Connect to Your PC

Founder can set up SSH keys, create and save connections, connect to their remote PC, and discover their TinSu projects — the complete first-time setup and one-tap reconnect experience.

### Story 2.1: Implement SSH Key Generation and Secure Storage

As a founder,
I want to generate SSH key pairs on my phone and have them stored securely,
So that I can authenticate with my remote PC without passwords and without my keys being exposed.

**Acceptance Criteria:**

**Given** the app is installed and running
**When** the founder initiates SSH key generation
**Then** an Ed25519 key pair is generated on the device (FR2)
**And** the private key is stored in Android Keystore / iOS Keychain via the `SecureKeyStore` expect/actual abstraction (FR8, NFR15)
**And** no private key material is written to plaintext storage at any point (NFR16)
**And** the public key is displayed on screen with a copy-to-clipboard button (FR3)
**And** instructions for adding the key to the remote PC's `authorized_keys` are shown
**And** the system supports Ed25519 (preferred), RSA 2048+, and ECDSA key types (NFR19)
**And** key generation completes within 3 seconds on a modern device

### Story 2.2: Create and Save Remote Connections

🎨 **FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.**

As a founder,
I want to create, save, edit, and delete remote PC connections with a display name,
So that I can one-tap connect to my PC without re-entering credentials.

**Acceptance Criteria:**

**Given** the founder opens the connection management screen
**When** the founder fills in host, port (default 22), and username
**Then** the connection is saved to the `connections` SQLDelight table with a user-provided display name (FR1, FR5)
**And** saved connections appear as cards showing display name, host, last connected timestamp, and a status indicator dot (UX-DR16)
**And** the founder can edit any saved connection's details (FR6)
**And** the founder can delete a saved connection with a confirmation dialog (FR6)
**And** the founder can select between SSH and mosh transport for each connection (FR7)
**And** the connection list supports reorder via drag handle (FR45)
**And** the connection form validates required fields (host, username) before save
**And** empty state shows a clear "Add Connection" prompt when no connections exist

### Story 2.3: Implement SSH Connection and Test Flow

As a founder,
I want to test my connection before saving it and get clear success/failure feedback,
So that I know my SSH setup works before relying on it.

**Acceptance Criteria:**

**Given** the founder has entered connection details and selected an SSH key
**When** the founder taps "Test Connection"
**Then** an SSH connection is established to the remote host using Apache MINA SSHD (Android) / SwiftNIO SSH (iOS) via the `RemoteExecutor` expect/actual abstraction (FR4, FR9)
**And** connection success shows a green checkmark with "Connected successfully" message
**And** connection failure shows a clear error message with troubleshooting hints (wrong host, auth failed, timeout, port blocked)
**And** the test connection completes or times out within 5 seconds (NFR1)
**And** the system works with OpenSSH 7.4+ on the remote PC (NFR21)
**And** the connection test is mandatory before the first save — cannot save an untested connection (UX-DR17)
**And** retry logic uses exponential backoff: 1s, 2s, 4s, 8s, max 30s, max 5 attempts

### Story 2.4: Implement Guided First-Time Setup Flow

🎨 **FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.**

As a founder,
I want a step-by-step guided setup when I first use the app,
So that I can go from install to connected in under 5 minutes without guesswork.

**Acceptance Criteria:**

**Given** the founder launches the app for the first time (no saved connections)
**When** the welcome flow begins
**Then** a welcome screen explains what TinSu Mobile does and what's needed (remote PC with SSH + TinSu desktop)
**And** the flow guides through: Enter host details → Generate/Import SSH key → View public key + copy → Add to authorized_keys instructions → Test connection → Save with display name (UX-DR17)
**And** each step is a distinct screen with clear back/next navigation
**And** the public key display includes an explicit `ssh-copy-id` or manual command to copy
**And** after successful save, the flow proceeds to project discovery (Story 2.5)
**And** the entire setup flow can be completed in under 5 minutes
**And** the flow can be skipped and returned to later

### Story 2.5: Discover and Select Remote Projects

As a founder,
I want to see all TinSu projects on my remote PC after connecting,
So that I can select which project to work on from my phone.

**Acceptance Criteria:**

**Given** the founder has an active SSH connection to their remote PC
**When** the system discovers projects
**Then** the system executes remote commands to find TinSu project directories on the remote machine (FR10)
**And** discovered projects are displayed as a selectable list with project name and path
**And** the founder can tap a project to select it as the active project (FR11)
**And** project discovery completes within 10 seconds for up to 20 projects (NFR10)
**And** the selected project is persisted in `app_preferences` so it's remembered on next app open
**And** the founder can switch between discovered projects at any time
**And** if no projects are found, a helpful message explains what to check on the remote PC

### Story 2.6: Implement Connection Status Display and Lifecycle

🎨 **FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.**

As a founder,
I want to always see my connection health at a glance,
So that I know whether my phone is connected to my PC without checking.

**Acceptance Criteria:**

**Given** the founder has connected to a remote PC
**When** the connection state changes
**Then** the ConnectionStatusBar displays in the TopAppBar area with 4 states: Connected (green dot + "Connected"), Reconnecting (yellow pulsing dot + "Reconnecting..."), Disconnected (red dot + "Disconnected"), Offline (gray dot + "Offline") (FR13, UX-DR3)
**And** state transitions animate with a 200ms color fade
**And** tapping the status bar opens a bottom sheet with connection details (host, port, transport, uptime, latency)
**And** the status bar is compact (8dp dot + label) and does not take a full row
**And** connection status is exposed as `StateFlow<ConnectionEvent>` from ConnectionManager with sealed cases: Connected, Reconnecting, Disconnected, Offline
**And** the app recovers gracefully from SSH timeout without crashing (NFR12)
**And** haptic feedback fires on connection established (success) and connection lost (warning) (UX-DR13)

---

## Epic 3: Chat with Your Agents

Founder can open agent chat sessions, view conversation history, send messages, receive streaming responses, and start new sessions with specific agent personas — the core mobile interaction loop.

### Story 3.1: Implement tmux Session Discovery and Attachment

As a founder,
I want the app to find and attach to my active tmux agent sessions on my remote PC,
So that I can continue conversations that are already running.

**Acceptance Criteria:**

**Given** the founder has an active SSH connection and a selected project
**When** the app discovers tmux sessions
**Then** the system executes `tmux list-sessions -F "#{session_name}"` via RemoteExecutor and filters by `tinsu-` prefix (FR12)
**And** sessions matching the pattern `tinsu-{projectName}-{taskId}` are identified and listed
**And** the system detects session status by parsing output patterns: thinking (agent processing), idle (waiting for input), completed (task done), exited (session ended) (FR23)
**And** session discovery refreshes automatically when the Chat tab is opened
**And** tmux sessions continue running on the remote PC independent of app state (NFR17)

### Story 3.2: Build Agent Chat Session List

🎨 **FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.**

As a founder,
I want to see all my active and previous agent chat sessions in a clear list,
So that I can quickly jump into the conversation I need.

**Acceptance Criteria:**

**Given** the founder navigates to the Chat tab
**When** tmux sessions have been discovered
**Then** sessions are displayed as tappable cards showing: agent persona icon, last message preview (truncated), SessionStatusChip (Active/Thinking/Idle/Completed/Exited), and timestamp (FR16, UX-DR23)
**And** the SessionStatusChip component shows 5 states with correct colors: Active (green), Thinking (yellow pulsing), Idle (gray), Completed (checkmark), Exited (red) (UX-DR4)
**And** sessions are sorted by most recently active first
**And** a FAB "+" button is visible for starting a new session
**And** tapping a session card navigates to the full chat view (Story 3.3)
**And** pull-to-refresh triggers session re-discovery
**And** empty state shows "No active sessions" with guidance
**And** session list navigation completes in <200ms (NFR5)

### Story 3.3: Implement Agent Chat Conversation View

🎨 **FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.**

As a founder,
I want to read the full conversation history with my agent and send new messages,
So that I can drive productive work from my phone just like chatting with a teammate.

**Acceptance Criteria:**

**Given** the founder opens a chat session
**When** the chat view loads
**Then** full message history loads from tmux scrollback via `tmux capture-pane -t {session} -p -S -500` (FR17)
**And** messages are displayed as ChatBubble components: user bubbles trailing-aligned (#1F3A5F), agent bubbles leading-aligned (#161B22) (UX-DR2)
**And** agent bubbles render inline markdown and code blocks with monospaced font (JetBrains Mono 13sp), surfaceVariant background, horizontal scroll, and copy button
**And** the message list is reverse-layout (newest at bottom) using `LazyColumn` (Android) / `ScrollView` + `LazyVStack` (iOS) (FR21)
**And** the chat input is a keyboard-aware expanding text field (up to 4 visible lines then scroll) with a send button (UX-DR10)
**And** keyboard appearance does not cause content jump — chat input stays visible above keyboard
**And** tapping send delivers the message via `tmux send-keys -t {session} "{escaped}" Enter` (FR18, FR19)
**And** sent messages appear immediately as a user bubble with a "sending" indicator (dimmed + clock icon)
**And** message send failures show a red outline with retry icon on the bubble
**And** light haptic tap fires on message sent (UX-DR13)
**And** chat message rendering completes in <500ms after agent responds (NFR6)

### Story 3.4: Implement Agent Response Streaming

As a founder,
I want to see my agent's response appear incrementally as it types,
So that I know the agent is working and can read output as it arrives instead of staring at a blank screen.

**Acceptance Criteria:**

**Given** the founder has sent a message to the agent
**When** the agent begins processing
**Then** a "Thinking" pulsing indicator appears inside a placeholder bubble (`LinearProgressIndicator` on Android, `ProgressView` on iOS) (UX-DR11)
**And** the system polls `tmux capture-pane -t {session} -p -S -500` at 1-second intervals to detect new output
**And** new content since the last poll is parsed for message boundaries (user input vs. agent output)
**And** agent output is rendered incrementally into the chat bubble as it arrives — text streams in visually
**And** the SessionStatusChip updates to "Thinking" (yellow pulsing) during agent processing and returns to "Active"/"Idle" when done
**And** partial agent responses are readable during streaming (not buffered until complete)
**And** chat history is cached locally in `chat_cache` table for offline reading

### Story 3.5: Start New Chat Session with Agent Persona

As a founder,
I want to start a new chat session and pick which agent persona to talk to,
So that I can begin new work streams from my phone with the right agent for the job.

**Acceptance Criteria:**

**Given** the founder taps the "+" FAB on the session list
**When** the new session flow opens
**Then** available agent personas are displayed as selectable chips: PM, Architect, Dev, QA, SM, Tech Writer, etc. (FR22)
**And** the founder selects a persona and taps "Start Session"
**And** a new tmux session is created on the remote PC matching the naming convention `tinsu-{projectName}-{taskId}` via SSH exec
**And** the appropriate Claude Code CLI command is executed in the new session
**And** the app navigates directly to the chat view for the new session
**And** the new session appears in the session list with "Active" status

---

## Epic 4: Read Planning Documents

Founder can browse, read, search, and navigate planning documents on their remote project with rendered markdown — and read cached docs offline.

### Story 4.1: Browse Remote Planning Documents

As a founder,
I want to browse the planning documents directory on my remote project,
So that I can find and open the document I need to read.

**Acceptance Criteria:**

**Given** the founder has an active connection and selected project
**When** the founder navigates to the Docs tab
**Then** the system lists markdown files from the remote planning documents directory via SFTP (FR24)
**And** documents are displayed as a flat list (not tree) with filename, file size, and last modified timestamp
**And** tapping a document opens the document viewer (Story 4.2)
**And** pull-to-refresh triggers re-scan of the remote directory
**And** loading state shows skeleton/shimmer while fetching the file list (UX-DR22)
**And** empty state explains "No planning documents found" with guidance

### Story 4.2: Read Rendered Markdown Documents

🎨 **FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.**

As a founder,
I want to read planning documents with beautiful rendered markdown formatting,
So that I can comfortably review PRDs, architecture docs, and specs from my phone.

**Acceptance Criteria:**

**Given** the founder taps a document in the browser
**When** the document loads
**Then** the markdown document is fetched via SFTP and rendered with full formatting: headings, bold/italic, code blocks, lists, tables, links (FR25)
**And** markdown rendering uses `multiplatform-markdown-renderer` (mikepenz) on Android and `MarkdownUI` (gonzalezreal) on iOS
**And** code blocks use JetBrains Mono font with `surfaceVariant` background and horizontal scroll
**And** typography follows UX spec: generous line height, comfortable reading on phone-sized screens
**And** pinch-to-zoom (1x–3x range) is available for detailed inspection (FR32, UX-DR12)
**And** pinch-to-zoom responds at 60fps (NFR8)
**And** the document view is full-screen with minimal chrome for maximum reading area
**And** pull-to-refresh re-fetches the document from remote

### Story 4.3: Cache Documents for Offline Reading

As a founder,
I want viewed documents to be available offline,
So that I can continue reading on the subway when I lose signal.

**Acceptance Criteria:**

**Given** the founder has viewed a document while connected
**When** the device goes offline
**Then** the previously viewed document is available from the local `document_cache` table (FR26)
**And** cached documents include: file path, content, last synced timestamp, file size
**And** cache lookup completes in <100ms (NFR9)
**And** on reconnect, cache invalidation compares remote file modified timestamp vs. local `last_synced` timestamp via SFTP stat (NFR14)
**And** stale documents are silently refreshed in the background on reconnect
**And** an "Offline — cached data" banner appears when viewing cached content without connection (UX-DR15)
**And** the founder can configure cache size and clear cache from Settings (FR47)

### Story 4.4: Search Within Documents and Navigate Internal Links

As a founder,
I want to search for text within a document and follow internal links between documents,
So that I can quickly find what I need in long planning specs.

**Acceptance Criteria:**

**Given** the founder is viewing a rendered markdown document
**When** the founder activates in-document search
**Then** a search bar appears at the top with text input and match count display (FR27)
**And** search results are highlighted inline as the founder types
**And** next/previous navigation buttons cycle through matches
**And** search is case-insensitive and matches partial words
**And** when the founder taps an internal markdown link (e.g., `[Architecture](architecture.md)`)
**Then** the linked document loads in the document viewer (FR28)
**And** back navigation returns to the previous document at the same scroll position

---

## Epic 5: Review Code & Act on Tasks

Founder can view implementation tasks, read code diffs with syntax highlighting, and approve/request changes/reject tasks — completing the full review cycle from their phone.

### Story 5.1: View Task List with Status Filtering

🎨 **FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.**

As a founder,
I want to see all my implementation tasks organized by status,
So that I can immediately spot which tasks need my review.

**Acceptance Criteria:**

**Given** the founder navigates to the Tasks tab
**When** task data is synced from the remote SQLite database
**Then** tasks are displayed as cards showing: task title, status indicator (badge color), brief summary, and assigned agent (FR29)
**And** tasks are filterable by status: Review, In Progress, Done, Blocked (UX-DR24)
**And** "Review" status tasks are surfaced first with a count badge (UX-DR24)
**And** the Tasks tab badge in bottom navigation shows the count of review-pending items (FR39)
**And** tapping a task in Review status navigates to the diff viewer (Story 5.2)
**And** pull-to-refresh triggers re-sync of task data from remote DB
**And** loading state shows skeleton/shimmer while syncing (UX-DR22)
**And** data is read from the mirrored `tasks` SQLDelight table (NFR22)

### Story 5.2: View Code Diffs with Syntax Highlighting

🎨 **FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.**

As a founder,
I want to read code diffs with syntax highlighting and clear visual change indicators,
So that I can understand exactly what the agent changed before approving.

**Acceptance Criteria:**

**Given** the founder opens a task in Review status
**When** the diff viewer loads
**Then** the system fetches the diff via SSH exec `git diff` on the remote project (FR30)
**And** the diff is parsed into DiffFile/DiffHunk/DiffLine models using the shared `DiffParser`
**And** each file has a collapsible DiffFileHeader showing filename, change summary (+X/-Y lines), and expand/collapse chevron (UX-DR6)
**And** DiffLine components display: line number gutter (old + new, dimmed monospaced) + code content in JetBrains Mono 13sp (UX-DR5)
**And** syntax highlighting is applied to code content (FR31)
**And** addition lines have `success` green at 15% opacity background with `+` prefix; deletion lines have `error` red at 15% opacity background with `-` prefix (UX-DR18)
**And** each diff line supports independent horizontal scroll for long lines
**And** pinch-to-zoom (1x–3x) is available via `detectTransformGestures` (Android) / `MagnifyGesture` (iOS) maintaining 60fps (FR32, NFR8, UX-DR12)
**And** diff rendering for files up to 1000 lines completes in <1 second (NFR7)
**And** `+`/`-` prefix is shown in addition to color for accessibility (UX-DR19)

### Story 5.3: Approve, Request Changes, or Reject Tasks

As a founder,
I want to approve, request changes, or reject a task directly from my phone,
So that I can complete the review cycle in 30 seconds without opening my laptop.

**Acceptance Criteria:**

**Given** the founder is viewing a code diff for a task in Review status
**When** the founder decides on a review action
**Then** a sticky bottom action bar displays three actions: Approve (primary filled button), Request Changes (secondary outlined button), Reject (destructive text button) (UX-DR14, UX-DR20)
**And** tapping Approve shows a brief confirmation dialog, then executes DB update + git merge via SSH shell commands on the remote PC (FR33)
**And** successful approval shows a Snackbar "Task approved" with medium impact haptic (UX-DR13)
**And** tapping Request Changes opens a text input for feedback, then submits and returns the task to In Progress (FR34)
**And** tapping Reject opens a text input for rejection reason, then shows a confirmation dialog, then returns the task to In Progress (FR35)
**And** all review actions are reflected immediately on the desktop app's next refresh (NFR23)
**And** after any action, the task list refreshes to show the updated status
**And** if offline, the review action is queued and delivered on reconnect with a visual queue indicator (UX-DR15)

### Story 5.4: View Agent Reasoning Log

As a founder,
I want to see the agent's reasoning log for a task,
So that I understand why the agent made specific implementation decisions before I approve.

**Acceptance Criteria:**

**Given** the founder is viewing a task detail
**When** the founder taps "View Reasoning" or expands the reasoning section
**Then** the agent's reasoning log is displayed with rendered markdown formatting (FR36)
**And** the reasoning log is fetched from the remote project via SFTP
**And** code references within the reasoning are displayed with monospaced font
**And** the reasoning log is scrollable and supports pinch-to-zoom
**And** the reasoning log is cached locally for offline viewing

---

## Epic 6: Project Dashboard & Status at a Glance

Founder sees a project overview with active sessions, pending reviews, and recent activity on one screen — the habit-forming "what happened since I left?" experience.

### Story 6.1: Build Project Dashboard Overview

🎨 **FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.**

As a founder,
I want to see a project overview the moment I connect,
So that I immediately know what happened since I last checked and what needs my attention.

**Acceptance Criteria:**

**Given** the founder connects to a remote PC and selects a project
**When** the project dashboard loads
**Then** the dashboard displays: count of active agent sessions, count of pending review tasks, count of recently completed tasks, and recent activity summary (FR37)
**And** each summary section is tappable, navigating to the relevant tab (Chat, Tasks) for details
**And** the dashboard is the first screen shown after project selection
**And** data is fetched from the mirrored SQLite tables and tmux session list
**And** loading state uses skeleton/shimmer, never a blank screen (UX-DR22)
**And** pull-to-refresh triggers full data re-sync

### Story 6.2: Implement Bottom Navigation with Badge Counts

🎨 **FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.**

As a founder,
I want to switch between project sections instantly with visible attention indicators,
So that I always know where action is needed without navigating through menus.

**Acceptance Criteria:**

**Given** the founder is within a project
**When** the bottom navigation is visible
**Then** 4 tabs are shown: Chat, Docs, Tasks, Settings with appropriate icons (FR38, UX-DR9)
**And** the Chat tab badge shows the count of sessions with "Thinking" or "Active" status
**And** the Tasks tab badge shows the count of tasks in "Review" status (FR39)
**And** badges use the `primary` accent color and disappear when count is 0
**And** switching between tabs completes in <200ms (NFR5)
**And** each tab maintains its own navigation stack (back within tab before switching tabs)
**And** app state (active tab, scroll position) is preserved across app backgrounding (NFR18)
**And** Material 3 `NavigationBar` on Android, `TabView` on iOS

---

## Epic 7: Resilient Connections & Settings

Founder gets mosh-based resilient connections that survive network transitions, offline mode with queued operations, and configurable settings for mosh, cache, and diagnostics.

### Story 7.1: Integrate Mosh for Resilient Connections

As a founder,
I want my connection to survive network transitions seamlessly,
So that I can keep working when my phone switches from WiFi to cellular or goes through a tunnel.

**Acceptance Criteria:**

**Given** the founder has a saved connection with mosh transport selected
**When** the founder connects
**Then** an SSH connection is established first, then mosh handoff completes in <3 seconds (NFR2)
**And** the mosh client is loaded via NDK-compiled library (Sonelli fork) on Android and Blink Shell fork on iOS
**And** mosh uses UDP port range 60000-61000 (configurable in settings) (NFR20)
**And** when the network transitions (WiFi ↔ cellular), mosh maintains the session with zero message loss (FR14, NFR11)
**And** brief disconnections (<30s) recover automatically via mosh protocol — the founder may not even notice
**And** the ConnectionStatusBar transitions: green → yellow "Reconnecting..." → green "Connected" during recovery (UX-DR3)
**And** automatic reconnection after signal loss completes within 10 seconds of network availability (NFR3)

### Story 7.2: Implement Offline Mode and Message Queuing

As a founder,
I want to read cached data offline and have my actions delivered when I reconnect,
So that losing signal doesn't mean losing my work or waiting helplessly.

**Acceptance Criteria:**

**Given** the founder is using the app and the network drops for an extended period
**When** the connection status changes to Disconnected/Offline
**Then** all cached data (documents, chat history, diffs, task list) remains readable from local SQLDelight tables (UX-DR15)
**And** an "Offline — cached data" banner appears at the top of the screen
**And** write operations (send message, approve/reject task) are queued in the `OfflineQueue` in FIFO order (FR15)
**And** a visual indicator shows "X messages pending" or "1 action queued" (UX-DR15)
**And** on reconnect, the queue is flushed in FIFO order automatically
**And** unsent messages are preserved across app backgrounding (NFR13)
**And** cache validation runs on reconnect: DB sync compares remote file modified timestamp vs. local last_synced; documents check per-file SFTP stat timestamps
**And** stale data is refreshed silently in the background
**And** the transition from offline to online is seamless — no blocking dialogs, just the banner disappearing

### Story 7.3: Implement Mosh and Connection Settings

🎨 **FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.**

As a founder,
I want to configure mosh port ranges and connection preferences,
So that I can adapt the app to my network environment and firewall rules.

**Acceptance Criteria:**

**Given** the founder navigates to Settings
**When** the founder opens connection/mosh settings
**Then** mosh UDP port range is configurable (default 60000-61000) with validation (FR46)
**And** mosh prediction mode can be toggled (adaptive, always, never)
**And** default transport (SSH or mosh) can be set for new connections
**And** connection timeout duration is configurable
**And** settings are persisted in the `app_preferences` SQLDelight table
**And** settings changes take effect on the next connection (not retroactive)

### Story 7.4: Implement Cache Management and App Diagnostics

🎨 **FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.**

As a founder,
I want to manage cached data and view connection diagnostics,
So that I can free up space when needed and troubleshoot connection issues.

**Acceptance Criteria:**

**Given** the founder navigates to Settings
**When** the founder opens cache management
**Then** current cache size is displayed (documents + chat + database) (FR47)
**And** the founder can set a maximum cache size
**And** the founder can clear all cached data with a confirmation dialog (FR47)
**And** the founder can clear cache by category (documents only, chat only, all)
**When** the founder opens diagnostics
**Then** app version, build number, and platform info are displayed (FR48)
**And** current connection details are shown: host, port, transport type, uptime, latency
**And** SSH library version and mosh client version are displayed
**And** a "Copy Diagnostics" button copies all info to clipboard for sharing
**And** recent connection events log is viewable (last 50 events with timestamps)
