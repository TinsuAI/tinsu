# TinSu Mobile -- Native UI Design Recommendations

**Date:** 2026-04-06
**Purpose:** Research and recommendations for Android (Jetpack Compose) and iOS (SwiftUI) native UI implementations. No code -- architecture and library decisions only.

---

## Design Thinking

**Purpose:** A mobile control plane that lets technical founders drive AI agent orchestration from a 6-inch phone screen via SSH/mosh to their desktop PC. This is a *power user productivity tool*, not a consumer app.

**Aesthetic Direction: Industrial-Utilitarian Terminal Luxe.** The app should feel like a refined control room -- dense with information but never cluttered. Think Bloomberg Terminal meets a well-designed dark-mode IDE. The visual language communicates *precision and competence*. Monospaced type for code and agent output. Generous use of the "ink on dark paper" metaphor. Status indicators that glow like instrument panel lights. No rounded pastel cards, no playful illustrations, no gratuitous gradients. This is a tool for people who think in terminals.

**Differentiation:** The one thing users will remember -- the seamless blend of terminal-grade information density with thumb-friendly mobile interaction. Chat bubbles that feel like tmux output wrapped in a native shell. Diffs that are genuinely readable on a phone.

---

## Android (Jetpack Compose + Material 3)

### 1. Design System & Component Library

**Material 3 Expressive** (shipped mid-2025, stable in Compose BOM 2025.05.01+)

Use Material 3 Expressive as the foundation. It provides 15+ refreshed components with springy motion physics, 35 shape options, richer dynamic color, and improved typography hierarchy. Key components to leverage:

| Component | Use Case |
|---|---|
| `NavigationBar` (M3) | Bottom tab navigation (Chat, Docs, Tasks, Settings) |
| `TopAppBar` (M3 `MediumTopAppBar`) | Collapsible app bar showing connection status + project name |
| `FloatingActionButton` (M3 Expressive) | Quick-connect action from any screen |
| `Card` (M3 `ElevatedCard`) | Session cards on dashboard, task cards in review list |
| `TextField` (M3 `OutlinedTextField`) | Chat input, search fields |
| `Badge` (M3) | Unread/pending counts on navigation items |
| `BottomSheet` (M3 `ModalBottomSheet`) | Connection details, review actions (approve/reject/request changes) |
| `Snackbar` (M3) | Connection status transitions, action confirmations |
| `Chip` (M3 `FilterChip`) | Agent persona selection, status filters |
| `LinearProgressIndicator` | Streaming agent response indicator |
| `SegmentedButton` (M3) | Toggle between unified/split diff view |

**Compose BOM Version:** `2025.05.01` or latest stable (check `developer.android.com/jetpack/compose-bom`)

**Additional Dependencies:**

| Library | Version | Purpose |
|---|---|---|
| `androidx.compose.material3:material3` | via BOM | Core M3 components |
| `androidx.compose.material3:material3-adaptive` | via BOM | Adaptive layouts for tablets/foldables |
| `androidx.navigation:navigation-compose` | 2.8.x+ | Type-safe navigation |
| `io.coil-kt.coil3:coil-compose` | 3.x | Image loading (avatars, cached doc images) |
| `com.mikepenz:multiplatform-markdown-renderer-android` | latest | Markdown rendering in Compose |
| `com.google.accompanist:accompanist-systemuicontroller` | latest | Status bar theming |

### 2. Navigation Architecture

**Pattern:** Bottom `NavigationBar` with 4 tabs, each tab owning its own `NavHost` and navigation graph.

**Tabs:**
1. **Chat** -- Agent sessions list -> individual chat -> session details
2. **Docs** -- Document browser -> rendered markdown viewer
3. **Tasks** -- Task list (filterable by status) -> diff viewer
4. **Settings** -- Connection manager, mosh config, cache, diagnostics

**Implementation:**

- Use **type-safe Navigation Compose** (Navigation 2.8+) with Kotlin `@Serializable` route objects instead of string routes. Each tab destination is a sealed class.
- Each tab maintains its own `NavController` so back-stack behavior is independent per tab. Switching tabs does not clear another tab's navigation state.
- Use `NavigationBar` with `NavigationBarItem`. Selected state derived from `currentBackStackEntryAsState()` comparing route classes via `NavDestination.hasRoute()`.
- Swipe gestures: **Do not** add swipe-between-tabs (conflicts with chat scroll and diff horizontal scroll). Use swipe-back for in-tab navigation only (default Compose behavior).
- Deep linking: Define intent filters for `tinsu://chat/{sessionId}` and `tinsu://task/{taskId}` to support future push notification navigation.

### 3. Chat UI Pattern

**Approach:** Custom Compose implementation. No third-party chat SDK (CometChat/Stream are overkill -- we are rendering local tmux output, not a real-time cloud chat).

**Architecture:**

- `LazyColumn` with `reverseLayout = true` for message list (newest messages at bottom, efficient scroll).
- Custom `ChatBubble` composable: user messages right-aligned (accent color), agent messages left-aligned (surface variant color). Agent bubbles use a monospaced font (`JetBrains Mono` or `Fira Code`) since agent output is often code/structured text.
- **Streaming responses:** Agent typing indicator shows as a pulsing `LinearProgressIndicator` inside an agent bubble placeholder. As chunks arrive from the tmux PTY, append to the current agent message composable. Use `AnnotatedString` for inline code formatting within messages.
- Session status pill at top: `Chip` composable showing "Thinking...", "Idle", "Completed", "Exited" with color-coded backgrounds.
- `SubcomposeLayout` avoidance: Use standard `Layout` for bubble sizing to avoid the 8% frame time penalty identified in production apps.

**Keyboard handling:**

- Set `android:windowSoftInputMode="adjustResize"` in manifest.
- Apply `Modifier.imePadding()` on the chat input container.
- Use `Modifier.consumeWindowInsets()` on nested inset-aware composables to prevent double padding.
- Chat input: `OutlinedTextField` with send button. Multi-line support (up to 4 visible lines, then scroll).
- `scrollDismissesKeyboard` equivalent: Detect scroll on the `LazyColumn` and call `LocalSoftwareKeyboardController.current?.hide()`.

### 4. Code Diff Viewer

**Approach:** Custom Compose implementation with WebView fallback for complex syntax highlighting.

**Primary strategy -- Native Compose:**

- Parse unified diff format into a data model: `DiffFile` -> `DiffHunk` -> `DiffLine` (added/removed/context).
- Render in a `LazyColumn` where each item is a `DiffLine` composable with:
  - Line number gutter (old + new line numbers, monospaced, dimmed)
  - Background tint: green-ish for additions, red-ish for deletions, transparent for context
  - Monospaced font for all code content (`JetBrains Mono`)
- **Unified diff only** on phone screens (not side-by-side -- there is not enough horizontal space). Offer a `SegmentedButton` toggle for split view only on tablets/foldables via `material3-adaptive`.
- **Horizontal scroll** per line for long lines: wrap each line in a `horizontalScroll` modifier. Do NOT wrap text -- code must preserve its formatting.
- **Pinch-to-zoom:** Apply `Modifier.graphicsLayer { scaleX = scale; scaleY = scale }` combined with `detectTransformGestures` on a `pointerInput` modifier. Clamp scale between 1.0x and 3.0x.
- File header: `Card` showing filename, change summary (+X / -Y lines), expandable.

**Fallback -- WebView with highlight.js:**

- For files where native rendering is insufficient (very complex syntax), embed an `AndroidView { WebView }` loading a local HTML template with PrismJS or highlight.js for full syntax coloring.
- This is a fallback, not the default. Native rendering is preferred for performance and gesture handling.

### 5. Markdown Renderer

**Library:** `multiplatform-markdown-renderer` by mikepenz (latest version)

**Rationale:** Best-maintained Compose markdown library. Supports headings, lists, code blocks (with optional syntax highlighting), tables, images (via Coil3), blockquotes, and thematic breaks. Provides `MarkdownDefaults` for color/typography customization and `Modifier`-based API that fits Compose idioms. Supports lazy loading for large documents.

**Configuration:**
- Custom theme matching the app's dark palette: code blocks with darker surface background, accent-colored links, properly sized headings.
- Enable syntax highlighting for code fences (integrates with highlight.js internally).
- Internal link navigation: intercept link clicks via the `onLinkClicked` callback, check if the URL matches another planning doc path, and navigate within the Docs tab NavHost.
- Search within document: Use `Modifier.findText()` or implement a custom highlight overlay that scrolls to matches.

### 6. Dark/Light Mode

**Implementation:**

- Use `MaterialTheme` with `dynamicDarkColorScheme(context)` / `dynamicLightColorScheme(context)` for Material You dynamic color on Android 12+.
- Fallback to custom dark/light `ColorScheme` for Android 10-11.
- Dark mode as **default** (this is a terminal-adjacent tool -- dark is the natural mode).
- Define a custom `ColorScheme` with:
  - **Dark theme:** Near-black background (`#0D1117` -- GitHub dark tone), muted surface colors, bright accent for active states (electric blue `#58A6FF` or terminal green `#3FB950`).
  - **Light theme:** Off-white background (`#F6F8FA`), dark text, same accent hues but adjusted for contrast.
- Follow system preference by default via `isSystemInDarkTheme()`, with manual override in Settings.
- Status bar and navigation bar theming via `SystemBarStyle` (edge-to-edge) -- transparent in dark mode, light surface in light mode.

### 7. Typography & Spacing

**Font Choices:**

| Role | Font | Rationale |
|---|---|---|
| Display/Headlines | `Geist` (Vercel) or `IBM Plex Sans` | Technical, clean, distinctive -- not generic. Geist has excellent weight range. |
| Body text | Same as display | Maintain consistency; these fonts are highly legible at body sizes. |
| Code / Agent output | `JetBrains Mono` or `Fira Code` | Purpose-built for code readability. Ligature support for operators. |
| UI labels / captions | Display font at reduced weight | Lighter weight for secondary information. |

**Spacing:**

- Minimum touch target: 48dp (Material 3 standard).
- Chat bubble padding: 12dp horizontal, 8dp vertical.
- List item height: 64dp minimum for thumb targets.
- Code diff line height: 20sp with 4dp vertical padding per line.
- Bottom navigation height: 80dp (M3 standard with labels).
- Content margins: 16dp horizontal.

**Text Sizing:**

- Support `sp` units throughout so Android accessibility font scaling works automatically.
- Code text: 13sp default (readable on 6-inch screens without zooming), scalable via pinch-to-zoom.
- Chat body: 15sp.
- Minimum contrast ratio: 4.5:1 for all text (WCAG AA).

---

## iOS (SwiftUI + Human Interface Guidelines)

### 1. Design System & Component Library

**Pure SwiftUI components** -- no third-party design system library needed. SwiftUI's built-in components already implement HIG patterns natively. Use SF Symbols for iconography.

Key SwiftUI components:

| Component | Use Case |
|---|---|
| `TabView` | Bottom tab navigation |
| `NavigationStack` | Per-tab navigation with type-safe routing |
| `List` / `ScrollView` + `LazyVStack` | Chat messages, task lists, doc browser |
| `TextField` / `TextEditor` | Chat input (multi-line) |
| `.sheet()` / `.fullScreenCover()` | Connection details, review action sheets |
| `.alert()` / `.confirmationDialog()` | Destructive actions (delete connection, reject task) |
| `Label` with SF Symbols | Navigation items, status indicators |
| `GroupBox` | Settings sections |
| `ProgressView` | Loading states, agent thinking indicator |
| `Menu` / `ContextMenu` | Long-press actions on sessions, connections |

**Dependencies:**

| Library | Version | Purpose |
|---|---|---|
| `swift-markdown-ui` (gonzalezreal) / `Textual` | latest | Full markdown rendering with theming |
| `HighlightSwift` (appstefan) | latest | Syntax highlighting for code blocks and diffs |
| `Highlightr` (raspu) or `HighlighterSwift` (smittytone) | latest | Alternative: NSAttributedString-based highlighting |
| `KeychainAccess` or native `Security` framework | -- | SSH key storage in iOS Keychain |

**No chat SDK needed** -- same rationale as Android. We are rendering tmux output, not building a real-time cloud chat. Custom SwiftUI views are the right approach.

### 2. Navigation Architecture

**Pattern:** `TabView` with 4 tabs, each containing its own `NavigationStack` with independent `NavigationPath`.

**Tabs:**
1. **Chat** (SF Symbol: `bubble.left.and.bubble.right`) -- sessions list -> chat view
2. **Docs** (SF Symbol: `doc.text`) -- document browser -> rendered markdown
3. **Tasks** (SF Symbol: `checklist`) -- task list -> diff viewer
4. **Settings** (SF Symbol: `gearshape`) -- connections, config, diagnostics

**Implementation:**

- Each tab owns a `@State private var path = NavigationPath()` for independent back-stack management.
- Define navigation destinations as an enum conforming to `Hashable`:
  ```
  enum ChatDestination: Hashable {
      case sessionList
      case session(id: String)
      case sessionDetails(id: String)
  }
  ```
- Use `.navigationDestination(for:)` modifiers for type-safe routing.
- Inject a `Router` object via `.environmentObject()` for programmatic navigation (deep links, push notification targets).
- **Swipe gestures:** Default iOS swipe-back gesture works automatically with `NavigationStack`. Do NOT add custom swipe-between-tabs.
- Tab badge counts: Use `.badge()` modifier on tab items for pending review count and active agent count.

### 3. Chat UI Pattern

**Approach:** Custom SwiftUI implementation.

**Architecture:**

- `ScrollViewReader` wrapping a `ScrollView` with `LazyVStack` for the message list. Pin scroll to bottom on new messages using `.scrollTo(lastMessageId, anchor: .bottom)`.
- Custom `ChatBubbleView`: user messages trailing-aligned with accent fill, agent messages leading-aligned with secondary surface fill. Use `.clipShape(RoundedRectangle(cornerRadius: 16))` with a tail shape overlay for the native Messages-like bubble aesthetic.
- Agent messages use a monospaced font (SF Mono or a custom-loaded `JetBrains Mono`).
- **Streaming responses:** Show a `ProgressView()` (spinning indicator) inside a bubble placeholder. As tmux output chunks arrive, incrementally build an `AttributedString` and update the view. SwiftUI's diffing efficiently handles appended text.
- Session status: `Label` with SF Symbol and colored tint -- `circle.fill` green for active, `clock` yellow for idle, `checkmark.circle` for completed, `xmark.circle` red for exited.

**Keyboard handling:**

- SwiftUI handles keyboard avoidance automatically for views inside `ScrollView` -- the scroll view adjusts its content insets.
- Add `.scrollDismissesKeyboard(.interactively)` on the chat `ScrollView` for drag-to-dismiss.
- Combine `@FocusState` on the `TextField` with `onSubmit` for send-on-return behavior.
- Multi-line input: Use `TextField` with `.lineLimit(1...4)` (iOS 16+) for auto-expanding multi-line input that caps at 4 lines.
- Safe area: The input bar should use `.safeAreaInset(edge: .bottom)` to sit above the keyboard and home indicator naturally.

### 4. Code Diff Viewer

**Approach:** Custom SwiftUI implementation with HighlightSwift for syntax coloring.

**Implementation:**

- Same data model as Android: parse unified diffs into `DiffFile` / `DiffHunk` / `DiffLine`.
- Render in a `List` or `LazyVStack` inside a `ScrollView`. Each row is a `DiffLineView` with:
  - Line number gutter (leading, monospaced, `.secondary` color)
  - Background: `.green.opacity(0.15)` for additions, `.red.opacity(0.15)` for deletions
  - Code text in SF Mono or JetBrains Mono
- **Unified diff only** on iPhone. No side-by-side on phone-width screens.
- **Horizontal scroll:** Wrap each code line in a `ScrollView(.horizontal, showsIndicators: false)` to handle long lines without wrapping.
- **Pinch-to-zoom:** Use `MagnifyGesture` (iOS 17+, formerly `MagnificationGesture`) to scale the content. Apply `.scaleEffect(scale)` clamped between 1.0 and 3.0. For iOS 16 compatibility, use `MagnificationGesture`.
- **Syntax highlighting:** Use `HighlightSwift` to produce `AttributedString` from code content, then render with `Text(attributedString)`. Process highlighting off the main thread to keep scrolling smooth.

**Review actions:**

- Sticky bottom bar with three buttons: "Approve" (green), "Request Changes" (yellow), "Reject" (red).
- "Request Changes" and "Reject" present a `.sheet()` with a `TextEditor` for feedback.
- Use `.confirmationDialog()` for destructive actions (Reject).

### 5. Markdown Renderer

**Library:** `MarkdownUI` by gonzalezreal (or its successor `Textual` if stable by implementation time)

**Rationale:** Most comprehensive SwiftUI markdown library. Supports full GitHub Flavored Markdown: headings, lists (including task lists), code blocks, tables, blockquotes, images, thematic breaks. Extensive theming API with built-in themes or custom overrides per block/inline style.

**Configuration:**
- Custom theme matching the app's dark-mode palette. Code blocks with darker background, accent-colored links.
- If using `HighlightSwift` alongside, integrate it for syntax-highlighted code fences.
- Internal link navigation: Use the `.onOpenURL` or MarkdownUI's link handler to intercept taps on links pointing to other planning docs, then push onto the Docs tab `NavigationPath`.
- Search: Implement search overlay using `UITextChecker` or simple string matching with scroll-to-match behavior.

### 6. Dark/Light Mode

**Implementation:**

- Use `@Environment(\.colorScheme)` to detect current mode.
- Define a custom color palette in the asset catalog with "Any Appearance" + "Dark Appearance" variants:
  - **Dark:** Background `#0D1117`, surface `#161B22`, accent `#58A6FF`, success `#3FB950`, warning `#D29922`, error `#F85149`.
  - **Light:** Background `#FFFFFF`, surface `#F6F8FA`, accent `#0969DA`, and similarly adjusted values.
- Dark mode as **default** via `preferredColorScheme(.dark)` at the app root, with manual toggle in Settings.
- Use semantic colors (`.primary`, `.secondary`, `.background`) via `Color` extensions for automatic light/dark switching.
- Respect system `Dynamic Type` settings -- all text uses SwiftUI's built-in scaling via `.font()` modifiers.

### 7. Typography & Spacing

**Font Choices:**

| Role | Font | Rationale |
|---|---|---|
| Display / Headlines | `SF Pro Display` or custom `Geist` | SF Pro is the native default and works perfectly with HIG. Geist is a strong custom option if you want visual parity with Android. |
| Body text | `SF Pro Text` or custom `IBM Plex Sans` | Optimized for small sizes on screen. |
| Code / Agent output | `SF Mono` or custom `JetBrains Mono` | SF Mono is native and requires no bundling. JetBrains Mono if you want cross-platform consistency. |
| UI labels / captions | System default (SF Pro) | Let iOS handle caption/footnote sizes natively. |

**Spacing:**

- Minimum touch target: 44pt (Apple HIG standard).
- Chat bubble padding: 12pt horizontal, 8pt vertical.
- List row minimum height: 44pt.
- Code diff line height: 18pt with 4pt vertical padding.
- Tab bar height: system default (49pt + safe area).
- Content margins: 16pt (standard `List` insets).

**Text Sizing:**

- Use SwiftUI `.font()` modifiers (`.body`, `.caption`, `.headline`, etc.) which automatically support Dynamic Type.
- Code text: `.system(size: 13, design: .monospaced)` as baseline, scalable via pinch-to-zoom.
- Chat body: `.body` (17pt default, scales with Dynamic Type).
- All text passes WCAG AA contrast (4.5:1) against both dark and light backgrounds.

---

## Shared Design Language (Cross-Platform Consistency)

### What SHOULD Be Consistent

| Element | Shared Specification |
|---|---|
| **Color palette** | Same hex values for accent, success, warning, error, code backgrounds. Both apps should feel like the same product. |
| **Dark mode default** | Both apps default to dark. Same background tone (`#0D1117`). |
| **Code font** | Same monospaced font across both platforms (`JetBrains Mono` if bundled, or each platform's native mono). The code viewing experience should feel identical. |
| **Iconography meaning** | Same icon concepts: chat = speech bubbles, docs = document, tasks = checklist, settings = gear. Use each platform's native icon set (SF Symbols on iOS, Material Symbols on Android) but keep the *semantic meaning* identical. |
| **Terminology** | Identical labels: "Agent Chat", "Planning Docs", "Code Review", "Approve", "Request Changes", "Reject". Never "Accept" on one and "Approve" on the other. |
| **Status indicators** | Same colors for connection states: green = connected, yellow = reconnecting, red = disconnected, gray = offline. Same agent states: green = active, yellow = thinking, gray = idle, checkmark = completed. |
| **Diff colors** | Green tint for additions, red tint for deletions. Same opacity levels. |
| **Information architecture** | Same 4-tab structure, same screen hierarchy, same feature scope per screen. |
| **Chat bubble alignment** | User messages on the right, agent messages on the left. Same on both platforms. |
| **Connection setup flow** | Same step sequence: choose connection type -> enter host details -> generate/import key -> test -> save. |

### What SHOULD Differ (Respect Platform Conventions)

| Element | Android | iOS |
|---|---|---|
| **Navigation bar style** | Material 3 `NavigationBar` with filled/outlined icon states | iOS `TabView` with SF Symbols and system blur background |
| **Back navigation** | System back button/gesture (predictive back in Android 14+) | Swipe-from-left-edge gesture (system default) |
| **Action sheets** | `ModalBottomSheet` rising from bottom | `.confirmationDialog()` / `.sheet()` with iOS action sheet style |
| **Pull-to-refresh** | Material 3 pull-to-refresh indicator (circular spinner) | Native SwiftUI `.refreshable` (spinner pulls down from top) |
| **Haptics** | Material 3 Expressive spring animations + haptic patterns | UIKit haptic feedback via `UIImpactFeedbackGenerator` |
| **Settings layout** | Material 3 list with switches and preference items | SwiftUI `Form` with `Toggle`, `Picker`, `Section` (native iOS settings feel) |
| **Font for non-code text** | Geist or IBM Plex Sans (custom) | SF Pro (system default) -- using the system font on iOS is the HIG-correct choice |
| **Share/export** | Android share sheet via `Intent.ACTION_SEND` | iOS share sheet via `ShareLink` / `UIActivityViewController` |
| **Notifications (Phase 3)** | Firebase Cloud Messaging | APNs |
| **Keyboard dismiss** | Tap outside or scroll (manual handling) | `.scrollDismissesKeyboard(.interactively)` (built-in) |
| **Empty states** | Material 3 illustration style | Minimal text + SF Symbol |

---

## Summary of Key Decisions

1. **No cross-platform UI framework.** Fully native on each platform. The UX quality ceiling is higher and both Compose and SwiftUI are mature enough to build this efficiently.

2. **No third-party chat SDK.** We are wrapping tmux terminal output, not building a cloud chat product. Custom bubble views are simpler and give full control over the terminal-to-touch translation.

3. **Material 3 Expressive on Android.** Use the latest design system -- it shipped mid-2025 and is the current standard. The springy animations and refined components elevate the experience.

4. **Pure SwiftUI on iOS.** No UIKit unless absolutely necessary. SwiftUI's navigation, keyboard handling, and component library are sufficient for everything in the MVP.

5. **Unified diff only on phones.** Side-by-side diff is unusable on 6-inch screens. Offer it only on tablets/foldables.

6. **Dark mode as default.** This is a terminal-adjacent tool. Dark is the natural environment.

7. **mikepenz/multiplatform-markdown-renderer on Android, MarkdownUI/Textual on iOS.** Both are the best-maintained markdown libraries for their respective platforms.

8. **Custom diff viewer on both platforms.** No adequate off-the-shelf mobile diff library exists. Build a custom `DiffLine`-based renderer with syntax highlighting (highlight.js on Android via WebView fallback, HighlightSwift on iOS).

9. **JetBrains Mono for code.** Cross-platform consistency for the most important visual element -- code readability.

10. **Type-safe navigation on both platforms.** Kotlin Serializable routes on Android, Hashable enums on iOS. Each tab owns its own navigation stack.
