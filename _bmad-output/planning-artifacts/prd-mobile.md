---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete']
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/product-brief-TinSu-2026-01-02.md
  - _bmad-output/planning-artifacts/project-context.md
workflowType: 'prd'
documentCounts:
  briefCount: 1
  researchCount: 0
  brainstormingCount: 0
  projectDocsCount: 2
classification:
  projectType: mobile_app
  domain: general
  complexity: medium
  projectContext: brownfield
date: '2026-04-06'
---

# Product Requirements Document - TinSu Mobile

**Author:** Tinsu
**Date:** 2026-04-06

## Executive Summary

TinSu Mobile is a native mobile app (Android + iOS) that extends the TinSu AI Agent Orchestration Platform to phones. It eliminates the desk dependency that currently locks founders out of their AI-powered workflows when away from their computer.

The app operates in two modes. **Remote Mode** (Android + iOS) connects to a PC via SSH/mosh where projects and Claude Code already run — the phone becomes a mobile-optimized control plane for existing work. **Local Mode** (Android only) runs projects directly on the device using Termux/F-Droid's Node.js runtime, making the phone a standalone development environment. Both modes present the same Tinsu UI: agent chat, planning document viewer, and implementation task review with code diffs.

This is not a monitoring dashboard or companion app. Founders can actively drive their projects from their phone — chatting with AI agents, reviewing code changes, reading planning artifacts — whether they're at a coffee shop, on a train, or out with friends. The same workflow that runs on desktop runs on mobile.

The mobile app targets the same primary user as the desktop app: technical founders who use Claude Code and the BMAD Method to build products. These users travel frequently and lose productive hours when they can't access their projects. TinSu Mobile turns dead time into work time.

### What Makes This Special

1. **Not a Dumbed-Down Companion:** Full project interaction — agent chat, doc reading, code review — not just notifications or status checks. You can actually ship work from your phone.

2. **Dual Runtime Architecture:** Android users get both local (Termux) and remote (SSH) modes. iOS users get remote mode. Same UI regardless of where the backend runs — the user doesn't think about infrastructure.

3. **Built on Battle-Tested Infrastructure:** Termux provides a real Linux environment on Android. Mosh provides resilient connections over spotty mobile networks. tmux provides session persistence. No novel infrastructure — just a proper UI on top of proven tools.

4. **Mobile-Native UX:** Purpose-built for touch on a 6-inch screen, not a responsive desktop layout crammed into a phone. Every interaction is designed for thumb-friendly navigation.

## Project Classification

**Technical Type:** mobile_app (Native Android + Native iOS)
**Domain:** General (Productivity/Developer Tools)
**Complexity:** Medium
**Project Context:** Brownfield — extends existing TinSu Electron desktop application

**Platform Capabilities:**

| Capability | Android | iOS |
|---|---|---|
| Local Mode (Termux) | Yes | No |
| Remote Mode (SSH/mosh) | Yes | Yes |
| Agent Chat | Yes | Yes |
| Doc Viewer | Yes | Yes |
| Code Review | Yes | Yes |

## Success Criteria

### User Success

**Core Experience:**

- Drive real project work from a phone — agent chat, doc reading, code review — not just monitoring
- Seamlessly connect to a remote PC and interact with existing projects as if sitting at the desk

**Aha Moment:**

- First time a founder SSHs into their PC from the train, chats with an agent, and makes real progress on their project from a 6-inch screen

**Measurable Outcomes:**

- Mobile sessions per week: founder uses TinSu Mobile 3+ times per week during travel/commute
- Session completion rate: >80% of mobile sessions result in meaningful interaction (not just opening and closing)
- Feature parity satisfaction: agent chat, doc viewer, and code review all functional and usable on mobile

### Business Success

**Product-Market Fit Signal:**

- Dog-food validation: "I can't stop using this on my phone" — founder reaches for TinSu Mobile in every dead moment
- Core mobile loop works reliably: Connect → Chat/Review/Read → Real progress made

**Scale Target:**

- Not a factor for MVP — solve founder's own travel problem first
- Post-validation: mobile becomes a competitive differentiator for TinSu's user acquisition

### Technical Success

**Connectivity:**

- SSH/mosh connection stays stable on 4G/LTE with graceful handling of network transitions (WiFi ↔ cellular)
- Mosh provides resilient connections — session survives brief connectivity drops without data loss

**Performance:**

- App launches and connects to remote PC within 10 seconds
- Agent chat messages send/receive with <2 second latency on stable connection
- UI remains responsive during active agent sessions — no freezing or blocking

**Platform:**

- Android app runs on Android 10+ (API 29+)
- iOS app runs on iOS 16+
- Termux integration (Android) successfully runs Node.js and Claude Code CLI

## User Journeys

### Journey 1: Technical Founder — Remote Work from the Train (Happy Path)

**Tinsu — From Dead Time to Productive Time**

It's Tuesday morning. Tinsu is on the commute — 45 minutes on the train. Yesterday he kicked off a Claude Code agent on his desktop to implement the payment processing feature. He pulls out his phone and opens TinSu Mobile.

The app shows his saved connection: "Home PC." He taps it. Mosh connects in 3 seconds — even though the train's cellular signal is bouncing between towers. The app lands on his project dashboard showing the familiar Planning Workspace.

He taps into the agent chat. The PM agent session from yesterday is still alive — tmux kept it running on his PC. He scrolls up to read the last exchange, then types a follow-up question about the PRD's scope section. The agent responds. Tinsu refines the requirement, sends another message. Back and forth, productive conversation — just like sitting at his desk.

He switches to the implementation tasks view. The payment story shows "Review" status — the dev agent finished overnight. He taps it and sees the diff: 4 files changed, 82 lines added. He pinch-zooms on a code block, spots a missing null check, and taps "Request Changes" with a note: "Handle null response from Stripe webhook."

The card moves back to In Progress. By the time Tinsu walks into the coffee shop near his office, the agent has already pushed a fix. He opens TinSu Mobile again, reviews the updated diff — clean this time — and taps "Approve." Done. A full review cycle completed from his phone before he even sat down at a desk.

### Journey 2: Technical Founder — Spotty Connection Recovery (Edge Case)

**Tinsu — When the Signal Drops**

Tinsu is working from a bar with friends. He's got TinSu Mobile open, chatting with the Architect agent about a database schema decision. Mid-conversation, his friend bumps the table and Tinsu's phone disconnects from the bar's flaky WiFi.

The app shows a yellow "Reconnecting..." banner. Mosh buffers his last unsent message. 8 seconds later, cellular kicks in. The banner turns green: "Connected." His message appears in the chat — the agent got it and is already responding. No context lost, no session restart, no re-authentication.

Later, in the subway with zero signal, Tinsu opens the app. The planning doc viewer shows cached documents from his last session. He reads through the PRD and architecture doc, making mental notes. When signal returns above ground, he opens a chat session and the tmux session on his PC is exactly where he left it.

### Journey 3: Technical Founder — First-Time Setup

**Tinsu — Getting Connected**

Tinsu downloads TinSu Mobile from the Play Store. On first launch, the app asks: "How do you want to connect to your project?"

He selects "Remote PC" and enters his PC's IP address. The app guides him through SSH key setup — generate a key pair on the phone, copy the public key to his PC. He pastes it into `~/.ssh/authorized_keys` on his desktop (the app shows the exact command to run).

He taps "Test Connection." Green checkmark — connected. The app discovers his TinSu projects on the remote machine and lists them. He selects "tinsu" and the project dashboard loads: his sprints, his planning workspace, his implementation tasks — all pulled from the remote SQLite database and project files via SSH.

Setup took 5 minutes. He bookmarks the connection for one-tap access next time.

### Journey Requirements Summary

These journeys reveal the following capability areas:

**From Journey 1 (Happy Path — Remote Work):**

- One-tap connection to saved remote PC
- Mosh-based resilient connectivity
- Agent chat with existing tmux sessions (read history, send messages, receive responses)
- Planning document viewer (markdown rendering)
- Implementation task list with status indicators
- Code diff viewer with pinch-zoom
- Approve/Request Changes actions on review tasks
- Session persistence — resume where you left off

**From Journey 2 (Edge Case — Spotty Connection):**

- Automatic reconnection on network transition (WiFi ↔ cellular)
- Visual connection status indicator (connected/reconnecting/offline)
- Mosh buffering for unsent messages
- Offline document cache for previously viewed planning docs
- tmux session survival on remote PC during disconnects

**From Journey 3 (First-Time Setup):**

- Connection type selection (Remote PC / Local — Android only)
- SSH key generation and management on device
- Guided setup flow with copy-pasteable commands
- Connection testing and validation
- Project discovery on remote machine
- Saved connections for one-tap access

## Innovation & Novel Patterns

### Detected Innovation Areas

**1. Mobile-Native CLI Wrapping: Touch UI Over Terminal Infrastructure**

Existing mobile SSH clients (Termius, JuiceSSH) expose raw terminal output. TinSu Mobile wraps the same SSH/mosh/tmux infrastructure in a purpose-built UI — chat bubbles for agent interaction, rendered markdown for docs, visual diffs for code review. The terminal is the transport layer, not the interface.

**2. Dual Runtime with Unified UI**

No existing mobile app offers both on-device CLI execution (via Termux) and remote PC connection through the same interface. Users don't switch apps or mental models — they switch a connection target. This is architecturally novel for mobile developer tools.

**3. Companion App That Actually Ships Work**

Mobile companion apps for developer tools (GitHub Mobile, Jira Mobile) are read-heavy: view issues, read notifications, approve PRs. TinSu Mobile enables write-heavy interaction — driving agent conversations, providing feedback, making real decisions. The phone becomes a production tool, not a monitoring tool.

### Market Context & Competitive Landscape

| Solution | Limitation |
|---|---|
| **Termius / JuiceSSH** | Raw terminal — no structured UI for agent chat or code review |
| **GitHub Mobile** | Read-heavy — view PRs, issues, but can't drive AI agents |
| **Replit Mobile** | Code editor focus — no agent orchestration or planning workflow |
| **Claude Mobile App** | Standalone chat — no project context, no persistent sessions, no code review |

TinSu Mobile occupies the whitespace: a **mobile control plane for AI agent orchestration** with structured UI on top of terminal infrastructure.

### Validation Approach

- Dog-food validation: founder uses TinSu Mobile daily during commute for 2+ weeks
- Success signal: "I reach for this every time I'm away from my desk"
- Measure: real work completed (agent chats, reviews approved) vs. sessions opened

### Risk Mitigation

| Innovation | Risk | Mitigation |
|---|---|---|
| Touch UI over terminal | Latency or rendering issues with complex output | Parse and render structured data; fall back to raw terminal view |
| Dual runtime | Termux integration fragility on Android updates | Termux maintained by active F-Droid community; abstract runtime interface |
| Write-heavy mobile | Typing on phone is slow for detailed feedback | Quick-action buttons, voice input option, templated responses |

## Mobile App Specific Requirements

### Project-Type Overview

TinSu Mobile is a native mobile application for Android and iOS that serves as a mobile extension of the TinSu desktop platform. Unlike typical mobile apps, it relies on SSH connectivity to a remote PC as its primary data and execution layer, with an optional local runtime on Android via Termux.

### Technical Architecture Considerations

#### Platform Requirements

| Platform | Minimum Version | Runtime | Distribution |
|---|---|---|---|
| Android | 10 (API 29) | Kotlin + Jetpack Compose | Google Play Store |
| iOS | 16 | Swift + SwiftUI | Apple App Store |
| Android (Local Mode) | 10 (API 29) | Termux (F-Droid) + Node.js | Sideload / F-Droid |

#### Connection Architecture

**Remote Mode (Both Platforms):**

| Component | Implementation |
|---|---|
| **Transport** | SSH2 for initial connection, mosh for resilient session |
| **Session Management** | Attach to existing tmux sessions on remote PC |
| **Data Channel** | SSH tunnel for structured data (project metadata, file contents, diffs) |
| **Agent I/O** | Write to tmux session stdin, read stdout via PTY attachment |
| **File Access** | SFTP for reading planning docs and code files |
| **Authentication** | SSH key pairs (Ed25519), stored in device secure keychain |

**Local Mode (Android Only):**

| Component | Implementation |
|---|---|
| **Runtime** | Termux (F-Droid) providing Linux environment |
| **Node.js** | Installed via `pkg install nodejs` in Termux |
| **Claude Code CLI** | Installed via npm in Termux environment |
| **Project Storage** | Termux-accessible shared storage or internal storage |
| **Session Management** | tmux running locally in Termux |

#### Offline Capabilities

| Feature | Offline Support |
|---|---|
| Cached planning documents | Read-only, last-synced version |
| Connection manager | View/edit saved connections |
| Agent chat history | Read cached messages |
| Code review diffs | Read cached diffs from last session |
| New agent messages | Queued, sent on reconnect |

#### Device Permissions

| Permission | Purpose | Platform |
|---|---|---|
| Internet | SSH/mosh connections | Both |
| Secure Storage / Keychain | SSH key storage | Both |
| Background Execution | Maintain mosh connection | Both |
| Local Storage | Document cache, connection profiles | Both |
| Termux API (Android) | Interprocess communication with Termux | Android |

### Implementation Considerations

**Cross-Platform Strategy:**

- Native implementations (Kotlin/Swift) rather than cross-platform framework
- Shared design language but platform-native interactions (Material 3 on Android, Human Interface Guidelines on iOS)
- Shared data models and connection logic where possible via Kotlin Multiplatform (KMP) consideration for shared business logic

**Mobile-Optimized UI Patterns:**

- Bottom navigation for primary sections (Chat, Docs, Tasks, Settings)
- Swipe gestures for navigation between sessions and documents
- Pull-to-refresh for syncing remote state
- Floating action button for quick connection
- Collapsible keyboard-aware chat input
- Pinch-to-zoom on code diffs and documents

**Data Synchronization:**

- No cloud backend — all data flows through SSH to remote PC
- Local cache for offline access (SQLite on device for metadata, file cache for documents)
- Cache invalidation on reconnect (compare timestamps)
- No sync conflicts — remote PC is the source of truth

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Problem-Solving MVP

- Solve the core pain (can't work when away from desk) with minimal but complete remote connectivity
- Focus on dog-food validation before external users
- Remote mode first — it works on both platforms and solves the immediate problem

**Resource Requirements:**

- Solo founder (dog-fooding)
- Prerequisites: TinSu desktop installed on PC, SSH access configured, Claude Code CLI running

### MVP Feature Set (Phase 1: Remote Mode)

**Core User Journeys Supported:**

1. Happy Path — Connect to PC, chat with agent, review code, approve changes
2. Setup Path — First-time SSH key setup and connection configuration

**Must-Have Capabilities:**

| Capability | Rationale |
|---|---|
| SSH/Mosh Connection Manager | Core connectivity — without this, nothing works |
| Agent Chat UI | Primary interaction — the #1 reason to use the app |
| Planning Doc Viewer | Read planning artifacts on the go |
| Code Review (Diff Viewer) | Review and act on agent output |
| Approve/Request Changes | Complete the review loop from mobile |
| Session Persistence (tmux) | Resume where you left off — critical for commute use |
| Connection Status Indicator | Know if you're connected, reconnecting, or offline |
| Saved Connections | One-tap access to your PC — no re-entering details |
| SSH Key Management | Generate, store, export public key |

**Explicitly Deferred from MVP:**

- Local Mode (Termux integration)
- Kanban board view
- Push notifications
- Multi-project switching
- Offline document editing
- Voice input

### Post-MVP Features

**Phase 2: Local Mode (Android Only)**

- Termux runtime integration
- On-device Claude Code CLI execution
- Local project file management
- Offline-first planning doc access

**Phase 3: Enhanced Mobile Experience**

- Push notifications (agent completion, review requests)
- Mobile Kanban board
- Quick actions from notifications
- Multi-project switching
- Sprint/epic overview

**Phase 4: Platform Maturity**

- Widget support (Android: quick status, iOS: lock screen widget)
- Voice input for agent chat
- Tablet-optimized layouts
- Share sheet integration (share code snippets, docs)

### Risk Mitigation Strategy

**Technical Risks:**

| Risk | Mitigation |
|---|---|
| SSH/mosh library stability on mobile | Use battle-tested libraries (libssh2 for SSH, mosh-client port) |
| Termux API changes on Android updates | Abstract Termux integration layer; monitor F-Droid releases |
| iOS background connection limits | Use mosh UDP protocol (survives iOS background); reconnect on foreground |
| Code diff rendering on small screens | Horizontal scroll with pinch-zoom; unified diff mode for narrow screens |
| Keyboard covers chat input | Keyboard-aware layout; auto-scroll; adjustable input area |

**Market Risks:**

| Risk | Mitigation |
|---|---|
| Users don't work from phones | Dog-food first; validate actual mobile usage patterns |
| Raw terminal apps are "good enough" | Validate that structured UI provides measurable productivity gain |

**Resource Risks:**

| Risk | Mitigation |
|---|---|
| Two native apps = double the work | MVP remote-only reduces scope; consider KMP for shared logic |
| Solo founder bandwidth | Lean MVP; ship Android first (founder's platform), iOS follows |

## Functional Requirements

### Connection Management

- FR1: Founder can create a new remote connection by entering host, port, and username
- FR2: Founder can generate an SSH key pair (Ed25519) on the device
- FR3: Founder can view and copy the public key for adding to remote PC's authorized_keys
- FR4: Founder can test a connection and see success/failure result
- FR5: Founder can save connections with a display name for one-tap access
- FR6: Founder can edit or delete saved connections
- FR7: Founder can select between SSH and mosh transport for a connection
- FR8: System stores SSH private keys in the device's secure keychain/keystore

### Remote Session Management

- FR9: System establishes SSH/mosh connection to the remote PC on founder's request
- FR10: System discovers and lists TinSu projects on the remote machine
- FR11: Founder can select a project to open from the discovered project list
- FR12: System attaches to existing tmux sessions on the remote PC for the selected project
- FR13: System detects and displays connection state (connected, reconnecting, disconnected, offline)
- FR14: System automatically reconnects via mosh when network transitions occur (WiFi ↔ cellular)
- FR15: System buffers unsent messages during brief disconnections and delivers them on reconnect

### Agent Chat

- FR16: Founder can view a list of active and previous chat sessions for the selected project
- FR17: Founder can open an existing chat session and view the full message history
- FR18: Founder can send a message to the agent in an active chat session
- FR19: System delivers messages to the Claude Code CLI process running in the remote tmux session
- FR20: System receives and displays agent responses in the chat UI as message bubbles
- FR21: Founder can scroll through chat history within a session
- FR22: Founder can start a new chat session with a selected agent persona (PM, Architect, Dev, etc.)
- FR23: System displays session status indicators (thinking, idle, completed, exited) for each session

### Planning Document Viewer

- FR24: Founder can browse the planning documents directory on the remote project
- FR25: Founder can open and read a markdown document with rendered formatting
- FR26: System caches viewed documents for offline reading
- FR27: Founder can search within a planning document
- FR28: Founder can navigate between documents via internal links

### Code Review

- FR29: Founder can view a list of implementation tasks with their current status
- FR30: Founder can open a task in Review status and view the code diff
- FR31: System displays diffs with syntax highlighting and line numbers
- FR32: Founder can pinch-to-zoom on code diffs for readability
- FR33: Founder can approve a reviewed task, triggering merge on the remote PC
- FR34: Founder can request changes on a reviewed task with written feedback
- FR35: Founder can reject a task with written feedback, returning it to In Progress
- FR36: System displays the agent's reasoning log for a task

### Project Dashboard

- FR37: Founder can view a project overview showing active agent sessions, pending reviews, and recent activity
- FR38: Founder can switch between project sections (Chat, Docs, Tasks) via bottom navigation
- FR39: System displays a count of items requiring attention (pending reviews, active agents)

### Local Mode (Android Only — Phase 2)

- FR40: Founder can configure Termux integration on Android
- FR41: System detects whether Termux and Node.js are installed
- FR42: Founder can open a local project directory as a TinSu project
- FR43: System runs Claude Code CLI locally within Termux for local projects
- FR44: Founder can use the same agent chat, doc viewer, and code review UI for local projects

### Settings & Configuration

- FR45: Founder can manage saved connections (add, edit, delete, reorder)
- FR46: Founder can configure mosh settings (port range, prediction mode)
- FR47: Founder can configure document cache size and clear cache
- FR48: Founder can view app version and connection diagnostics

## Non-Functional Requirements

### Performance

**Connection:**

- NFR1: SSH connection establishment completes in <5 seconds on stable network
- NFR2: Mosh session handoff completes in <3 seconds after network transition
- NFR3: Automatic reconnection after signal loss completes within 10 seconds of network availability

**UI Responsiveness:**

- NFR4: App cold start to connection list screen in <2 seconds
- NFR5: Navigation between sections (Chat, Docs, Tasks) completes in <200ms
- NFR6: Chat message rendering (send to display) completes in <500ms after agent responds
- NFR7: Code diff rendering for files up to 1000 lines completes in <1 second
- NFR8: Pinch-to-zoom on diffs and documents responds at 60fps

**Data:**

- NFR9: Document cache lookup completes in <100ms
- NFR10: Project discovery on remote machine completes in <10 seconds for up to 20 projects

### Reliability

**Connection Resilience:**

- NFR11: Mosh sessions survive network transitions (WiFi ↔ cellular) with zero message loss
- NFR12: App recovers gracefully from SSH connection timeout without crashing
- NFR13: Unsent messages are preserved across app backgrounding and delivered on reconnect

**Data Integrity:**

- NFR14: Cached documents are validated against remote timestamps on reconnect
- NFR15: SSH key storage uses platform secure enclave (Android Keystore / iOS Keychain)
- NFR16: No user credentials are stored in plaintext at any point

**Session:**

- NFR17: Remote tmux sessions are unaffected by mobile app crashes — session continues on PC
- NFR18: App state (active project, active section, scroll position) is preserved across app backgrounding

### Integration

**SSH/Mosh:**

- NFR19: SSH implementation supports Ed25519, RSA (2048+), and ECDSA key types
- NFR20: Mosh implementation supports UDP port range 60000-61000 (configurable)
- NFR21: System works with OpenSSH 7.4+ on the remote PC

**TinSu Desktop:**

- NFR22: Mobile app reads the same SQLite database and project file structure as the desktop app via SSH/SFTP
- NFR23: Actions taken on mobile (approve, request changes) are reflected immediately on the desktop app's next refresh

**Termux (Android):**

- NFR24: Termux integration works with Termux 0.118+ from F-Droid
- NFR25: System detects Termux installation status and Node.js availability within 2 seconds

### Platform

- NFR26: Android app follows Material 3 design guidelines
- NFR27: iOS app follows Human Interface Guidelines
- NFR28: Both apps support dark mode and light mode
- NFR29: Both apps support dynamic text sizing / accessibility font scaling
- NFR30: Android app targets SDK 34 with minSdk 29
- NFR31: iOS app supports iPhone SE (2nd gen) and larger screen sizes
