# Story mobile-2.2: Create and Save Remote Connections

Status: ready-for-dev

## Story

As a founder,
I want to create, save, edit, and delete remote PC connections with a display name,
So that I can one-tap connect to my PC without re-entering credentials.

## Acceptance Criteria

1. **Connection CRUD:** The founder can create, read, update, and delete remote PC connections via the connection management screen (FR1, FR5, FR6).
2. **Required Fields:** Connections require host, port (default 22), username, and display name to save.
3. **Transport Selection:** The founder can select between SSH and mosh transport for each connection (FR7).
4. **Saved Connection Cards:** Saved connections appear as cards showing display name, host:port, last connected timestamp, and a status indicator dot (UX-DR16).
5. **Edit and Delete:** The founder can edit any saved connection's details and delete with a confirmation dialog (FR6).
6. **Drag-to-Reorder:** The connection list supports reorder via drag handle (FR45).
7. **Field Validation:** The connection form validates required fields (host, username, display name) before save and shows inline errors.
8. **Empty State:** Shows a clear "Add Connection" prompt with a prominent action button when no connections exist.
9. **SSH Key Association:** Each connection can optionally associate with a stored SSH key alias (from SecureKeyStore) for authentication.

## Tasks / Subtasks

- [ ] Task 1: Add `ssh_key_alias` column to Connections table (AC: #9)
  - [ ] Create migration file `mobile/shared/src/commonMain/sqldelight/com/tinsu/mobile/db/Connections.sq` with version 2
  - [ ] Add `ssh_key_alias TEXT` column (nullable, since not all connections require SSH keys — password auth may be added later)
  - [ ] Add `ALTER TABLE connections ADD COLUMN ssh_key_alias TEXT;` to migration
  - [ ] Update SQLDelight schema to include new column in CREATE TABLE
  - [ ] Update insert/select queries to include ssh_key_alias
  - [ ] Create `update` query for editing existing connections (currently missing)

- [ ] Task 2: Create `TransportType` enum in commonMain (AC: #3)
  - [ ] Create `shared/src/commonMain/kotlin/com/tinsu/mobile/connection/TransportType.kt`
  - [ ] Define `enum class TransportType { SSH, MOSH }`
  - [ ] Add `displayName: String` property for UI display ("SSH", "mosh")
  - [ ] Add `defaultValue: TransportType = SSH` for connections

- [ ] Task 3: Create `ConnectionConfig` data model in commonMain (AC: #1, #2, #3)
  - [ ] Create `shared/src/commonMain/kotlin/com/tinsu/mobile/connection/ConnectionConfig.kt`
  - [ ] Define `data class ConnectionConfig(`
    - `id: String? = null,` — null for new connections, set for existing
    - `displayName: String,`
    - `host: String,`
    - `port: Int = 22,`
    - `username: String,`
    - `transportType: TransportType = TransportType.SSH,`
    - `sshKeyAlias: String? = null,` — optional reference to SecureKeyStore key
    - `sortOrder: Int = 0,`
    - `lastConnectedAt: Long? = null,`
    - `createdAt: Long = System.currentTimeMillis(),`
    - `updatedAt: Long = System.currentTimeMillis()`
    - `)`
  - [ ] Add validation function `fun isValid(): Result<Unit>` that checks host, username, display name are non-empty

- [ ] Task 4: Create `ConnectionRepository` in commonMain (AC: #1, #5, #6, #9)
  - [ ] Create `shared/src/commonMain/kotlin/com/tinsu/mobile/connection/ConnectionRepository.kt`
  - [ ] Define interface with suspend functions:
    - `suspend fun getAllConnections(): Result<List<ConnectionConfig>>`
    - `suspend fun getConnectionById(id: String): Result<ConnectionConfig>`
    - `suspend fun createConnection(config: ConnectionConfig): Result<ConnectionConfig>` — generates UUID, sets timestamps
    - `suspend fun updateConnection(config: ConnectionConfig): Result<ConnectionConfig>` — updates updated_at timestamp
    - `suspend fun deleteConnection(id: String): Result<Unit>`
    - `suspend fun reorderConnectionIds(ids: List<String>): Result<Unit>` — updates sort_order for drag-reorder
  - [ ] Use `com.tinsu.mobile.db.TinsuMobile` database driver from Koin DI
  - [ ] Map SQLDelight `connections` database entity to `ConnectionConfig` domain model
  - [ ] Handle SQL errors and wrap in `Result.Failure(AppError.DatabaseError(...))`

- [ ] Task 5: Implement Android Compose connection management UI (AC: #2, #4, #5, #6, #7, #8)
  - [ ] Create `shared/src/androidMain/kotlin/com/tinsu/mobile/connection/ConnectionRepositoryImpl.kt` — actual implementation using SQLDelight queries
  - [ ] Create `mobile/androidApp/src/main/java/com/tinsu/mobile/ui/connection/ConnectionListScreen.kt`
  - [ ] Create `mobile/androidApp/src/main/java/com/tinsu/mobile/ui/connection/ConnectionEditScreen.kt`
  - [ ] Create `mobile/androidApp/src/main/java/com/tinsu/mobile/ui/connection/ConnectionCard.kt` — Composable for connection card with:
    - Display name (large text)
    - host:port (secondary text)
    - Last connected timestamp (tertiary text, relative time like "2h ago")
    - Status indicator dot (gray = not tested, green = connected recently, red = failed)
  - [ ] Implement drag-to-reorder using `Modifier.dragAndDrop()` or `ReorderableItem` API
  - [ ] Implement form validation with inline error text below each field
  - [ ] Implement transport type selection as SegmentedButton or RadioGroup
  - [ ] Implement SSH key selection dropdown (populated from SecureKeyStore.listKeys())
  - [ ] Implement empty state with "Add Connection" FAB or centered button
  - [ ] Follow Terminal Luxe design system from mobile-1-4/1-5 (Industrial-Utilitarian aesthetic)

- [ ] Task 6: Implement iOS SwiftUI connection management UI (AC: #2, #4, #5, #6, #7, #8)
  - [ ] Create `shared/src/iosMain/kotlin/com/tinsu/mobile/connection/ConnectionRepositoryImpl.kt` — actual implementation using SQLDelight queries
  - [ ] Create `mobile/iosApp/iosApp/ConnectionListScreen.swift`
  - [ ] Create `mobile/iosApp/iosApp/ConnectionEditScreen.swift`
  - [ ] Create `mobile/iosApp/iosApp/ConnectionCardView.swift` — View for connection card matching Android design
  - [ ] Implement drag-to-reorder using `.onMove(perform:)` on List
  - [ ] Implement form validation with inline error labels
  - [ ] Implement transport type selection as Picker
  - [ ] Implement SSH key selection as Picker with "No Key" option
  - [ ] Implement empty state with "Add Connection" button
  - [ ] Follow Terminal Luxe design system from mobile-1-4/1-5

- [ ] Task 7: Register `ConnectionRepository` in Koin DI (AC: #1)
  - [ ] Android: Add to `mobile/shared/src/androidMain/kotlin/com/tinsu/mobile/di/AndroidModule.kt`
    - `singleOf(::ConnectionRepositoryImpl) { bind<ConnectionRepository>() }`
  - [ ] iOS: Add to `mobile/shared/src/iosMain/kotlin/com/tinsu/mobile/di/KoinHelper.kt`
    - `singleOf(::ConnectionRepositoryImpl) { bind<ConnectionRepository>() }`

- [ ] Task 8: Create `ConnectionListViewModel` for state management (AC: #4, #5)
  - [ ] Create `mobile/shared/src/commonMain/kotlin/com/tinsu/mobile/connection/ConnectionListViewModel.kt`
  - [ ] Use `kotlinx.coroutines.flow.StateFlow` for connections list state
  - [ ] Implement functions: `loadConnections()`, `deleteConnection(id)`, `reorderConnections(ids)`
  - [ ] Handle loading, error, and success states
  - [ ] Follow existing ViewModel patterns from project

- [ ] Task 9: Write unit tests for `ConnectionRepository` (AC: #1, #2, #3, #9)
  - [ ] Create `shared/src/commonTest/kotlin/com/tinsu/mobile/connection/ConnectionRepositoryTest.kt`
  - [ ] Test CRUD operations with in-memory SQLDelight driver
  - [ ] Test validation logic for invalid inputs
  - [ ] Test sort_order updates on reorder
  - [ ] Test ssh_key_alias association (null and non-null cases)

- [ ] Task 10: Add update query to Connections.sq (AC: #5)
  - [ ] Add `update:` query to `Connections.sq`:
    ```sql
    UPDATE connections SET display_name = ?, host = ?, port = ?, username = ?, transport = ?, ssh_key_alias = ?, sort_order = ?, last_connected_at = ?, updated_at = ? WHERE id = ?;
    ```
  - [ ] Add `selectAllSortedByOrder:` query for list display:
    ```sql
    SELECT * FROM connections ORDER BY sort_order ASC, created_at DESC;
    ```

## Dev Notes

### Architecture Compliance

- **KMP expect/actual pattern is mandatory.** Define `ConnectionRepository` as an interface in `commonMain`, implement `ConnectionRepositoryImpl` as `actual class` in `androidMain` and `iosMain`. NEVER use `#if` platform checks in shared code.
- **Package:** `com.tinsu.mobile.connection` — this matches the architecture document's file structure specification exactly.
- **Database:** Use SQLDelight for local persistence. The `connections` table already exists but needs schema migration for `ssh_key_alias` column.
- **Error handling:** Use the existing `Result<T>` sealed interface from `com.tinsu.mobile.util.Result` and `AppError` from `com.tinsu.mobile.util.AppError`. Add new error case `data class InvalidConnectionDetails(val reason: String) : AppError` to `AppError.kt`.
- **Koin DI:** Register `ConnectionRepository` as a singleton in the DI graph. Follow the existing pattern in `SharedModule.kt`.
- **Terminal Luxe Design System:** Follow the Industrial-Utilitarian aesthetic established in mobile-1-4 (Android) and mobile-1-5 (iOS):
  - Color palette: high-contrast terminal colors (amber/cyan on dark backgrounds)
  - Typography: monospace fonts, tabular numbers
  - Components: sharp corners, technical aesthetic, visible borders
  - Icons: simple line icons, consistent stroke width

### Critical Technical Decisions

**Database Migration Strategy:**
- The existing `Connections.sq` table does NOT have an `ssh_key_alias` column.
- SQLDelight requires explicit migration files: create `Connections.sq` version 2 with the new column.
- Migration file naming: `Connections.sq` → SQLDelight tracks versions via `.db` file schema version.
- Use `ALTER TABLE connections ADD COLUMN ssh_key_alias TEXT;` for non-breaking migration.
- The column is nullable to support future password-based authentication (SSH keys not required for all connections).

**Transport Type Storage:**
- Store as TEXT in database: `"ssh"` or `"mosh"` (lowercase for consistency)
- Map between `TransportType` enum and database string in repository layer
- Default to `"ssh"` for existing connections without explicit transport setting

**Sort Order Implementation:**
- Use `sort_order INTEGER NOT NULL DEFAULT 0` column
- On reorder, reassign sequential integers (0, 1, 2, ...) to all connections
- Query: `ORDER BY sort_order ASC, created_at DESC` for stable sort

**Drag-to-Reorder:**
- Android: Use `Foundation`'s `lazyGrid` with `ReorderableItem` modifier or `ItemBinding` API
- iOS: Use SwiftUI's `.onMove(perform:)` on List with `onDelete(perform:)` for swipe delete
- Reorder operations update all `sort_order` values atomically in a single transaction

### Connections Table Schema (After Migration)

```sql
CREATE TABLE connections (
    id TEXT NOT NULL PRIMARY KEY,
    display_name TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 22,
    username TEXT NOT NULL,
    transport TEXT NOT NULL DEFAULT 'ssh',
    ssh_key_alias TEXT,                    -- NEW: nullable, references SecureKeyStore key alias
    sort_order INTEGER NOT NULL DEFAULT 0,
    last_connected_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
```

### Validation Rules

- `display_name`: Required, trimmed length 1-50 characters
- `host`: Required, trimmed length 1-255 characters, valid hostname or IP (basic validation, full DNS check on connect test)
- `port`: Required, integer range 1-65535
- `username`: Required, trimmed length 1-100 characters
- `transportType`: Required, must be valid enum value
- `sshKeyAlias`: Optional, if provided must exist in SecureKeyStore (validate on save)

### File Structure

```
mobile/shared/src/
  commonMain/kotlin/com/tinsu/mobile/
    connection/
      TransportType.kt               → Enum (NEW)
      ConnectionConfig.kt            → Data model (NEW)
      ConnectionRepository.kt        → Repository interface (NEW)
      ConnectionListViewModel.kt     → State management (NEW)
  androidMain/kotlin/com/tinsu/mobile/
    connection/
      ConnectionRepositoryImpl.kt    → Android actual (NEW)
  iosMain/kotlin/com/tinsu/mobile/
    connection/
      ConnectionRepositoryImpl.kt    → iOS actual (NEW)
  commonMain/sqldelight/com/tinsu/mobile/db/
    Connections.sq                   → Schema + migration v2 (MODIFIED)

mobile/androidApp/src/main/java/com/tinsu/mobile/ui/connection/
  ConnectionListScreen.kt            → List with cards (NEW)
  ConnectionEditScreen.kt            → Form for add/edit (NEW)
  ConnectionCard.kt                  → Card composable (NEW)

mobile/iosApp/iosApp/
  ConnectionListScreen.swift         → List with cards (NEW)
  ConnectionEditScreen.swift         → Form for add/edit (NEW)
  ConnectionCardView.swift           → Card view (NEW)
```

### Anti-Patterns to Avoid

- **DO NOT** store passwords in the database — password auth is out of scope for this story, only SSH key association
- **DO NOT** use platform-specific imports (`android.*`, `UIKit.*`) in `commonMain`
- **DO NOT** hardcode UI text — use string resources (Android) / Localizable.strings (iOS)
- **DO NOT** implement drag-to-reorder with manual touch handling — use platform APIs (LazyVerticalGrid reorder, List.onMove)
- **DO NOT** skip validation on the backend — validate in both UI (inline) and repository layer
- **DO NOT** use blocking database operations — all repository functions must be `suspend`
- **DO NOT** create multiple `ConnectionRepository` implementations per platform — use expect/actual pattern for single interface

### Testing Requirements

- **Framework:** kotlin-test for commonTest, JUnit for androidUnitTest, XCTest for iOS
- **Co-location:** Tests next to source (existing project convention from mobile-1-3)
- **Coverage:**
  - All public functions of `ConnectionRepository` must have test coverage
  - Validation logic must be tested with valid and invalid inputs
  - Reorder logic must preserve list integrity
  - SQLDelight queries must be tested with in-memory driver
- **UI Tests:** Platform-specific UI tests for drag-reorder and form submission (optional but recommended)

### Project Structure Notes

- Alignment with architecture doc's target structure in `architecture-mobile.md` lines 654-661
- `connection/` package is new — first files in this package for the mobile project
- Follows existing pattern: `security/` package from mobile-2-1, `util/` for shared utilities, `di/` for DI modules
- Database migration pattern: SQLDelight schema files in `commonMain/sqldelight/com/tinsu/mobile/db/`

### Previous Story Intelligence

**From mobile-2-1 (SSH Key Generation):**

- **SecureKeyStore Pattern:** The `SecureKeyStore` expect/actual pattern was established in `security/SecureKeyStore.kt`. Follow this exact pattern for `ConnectionRepository`.
- **Koin DI Pattern:** Android uses `single { SecureKeyStore(androidContext()) }` in `AndroidModule.kt`. iOS uses constructor injection with Swift bridge for Ed25519. `ConnectionRepository` is simpler — no platform bridge needed, just SQLDelight.
- **Error Handling:** Added `KeyGenerationFailed` and `KeyNotFound` to `AppError.kt`. Add `InvalidConnectionDetails` and `ConnectionNotFound` for this story.
- **SQLDelight Setup:** Database driver is available via Koin as `TinsuMobile(get())`. The `connections` table exists but lacks `ssh_key_alias` column — this story adds the migration.
- **Naming Conventions:** Database columns use `snake_case` (e.g., `ssh_key_alias`), Kotlin classes use `PascalCase`, functions use `camelCase`.
- **Review Findings from mobile-2-1:**
  - iOS code had several issues with CFError pointers, deprecated APIs, and unchecked casts — be extra careful with Kotlin/Native interop
  - Always validate inputs (alias parameter was unvalidated in mobile-2-1, add validation for all connection fields)
  - Use type-safe operations (avoid unchecked casts, use proper error handling)

### Git Intelligence

Recent commits follow `feat: {description} (mobile-{epic}-{story})` format. The mobile project uses:
- Gradle version catalog: `mobile/gradle/libs.versions.toml`
- Shared module dependencies: `mobile/shared/build.gradle.kts`
- Android app: Compose UI with Kotlin
- iOS app: SwiftUI with Kotlin/Native interop

Recent relevant commit:
```
c2417b9 feat: implement SSH key generation and secure storage (mobile-2-1)
```

This commit established the security package structure and SecureKeyStore pattern. Follow the same file organization and code style.

### References

- [Source: architecture-mobile.md#Connection Management] — Connection CRUD, transport types, file structure
- [Source: architecture-mobile.md#Core Architectural Decisions] — expect/actual pattern, SQLDelight usage
- [Source: architecture-mobile.md#Implementation Patterns] — Naming conventions, error handling
- [Source: epics-mobile.md#Story 2.2] — Acceptance criteria, FR1, FR5, FR6, FR7, UX-DR16, FR45
- [Source: prd-mobile.md#Connection Management] — FR1-FR8 functional requirements
- [Source: mobile-2-1 implementation] — SecureKeyStore pattern, Koin DI pattern, SQLDelight setup
- [Source: project-context.md] — Desktop app conventions (connections table schema reference)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- Story file created with comprehensive developer guidance
- Database migration identified for `ssh_key_alias` column addition
- expect/actual pattern specified for `ConnectionRepository`
- Terminal Luxe design system requirements documented
- Previous story intelligence from mobile-2-1 incorporated

### File List

- `_bmad-output/implementation-artifacts/mobile-2-2-create-and-save-remote-connections.md` (NEW — this file)

### Next Steps

1. Review the comprehensive story in this file
2. Run dev agents: Use Skill tool to invoke `/bmad-bmm-dev-story mobile-2-2`
3. Run `/bmad-bmm-code-review mobile-2-2` when implementation is complete
