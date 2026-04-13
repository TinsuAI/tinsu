# Story T2.2: Remote Connection Management UI

Status: review

## Story

As a founder,
I want to add, test, edit, and remove SSH connection profiles,
so that I can manage my remote machines from within TinSu.

## Acceptance Criteria

1. **Given** SSH key management from T2.1 **When** I open Settings **Then** an "SSH Connections" section is visible with a list of saved connection profiles

2. **Given** the SSH Connections section **When** I click "Add Connection" **Then** a dialog appears with fields: Host (text), Port (number, default 22), Username (text), Auth Method (dropdown: "SSH Key" | "Password")

3. **Given** auth method is "SSH Key" **When** the Add Connection dialog is open **Then** a "Select Key" dropdown lists all stored SSH key names (from `list_ssh_keys` command); if no keys exist, a prompt says "Generate an SSH key first" with a link to the key management section

4. **Given** auth method is "Password" **When** the Add Connection dialog is open **Then** a password input field is shown (masked, not stored in DB — only used for test connection)

5. **Given** a connection profile filled out **When** I click "Test Connection" **Then** the backend attempts an SSH connection: connects to host:port, verifies server fingerprint, authenticates with the chosen method, and returns either `{ success: true, fingerprint: "SHA256:..." }` or `{ success: false, error: "..." }`

6. **Given** a test connection attempt **When** it completes **Then** the dialog shows: green checkmark + server fingerprint on success, or red error message on failure; test completes in <5 seconds on low-latency networks (NFR33)

7. **Given** a successfully configured connection **When** I click "Save" **Then** the profile is persisted in the `ssh_connections` DB table (host, port, username, auth_method, key_name — but NOT the password) and appears in the connection list

8. **Given** a saved connection in the list **When** I click the edit icon **Then** the Add Connection dialog opens pre-filled with the saved values

9. **Given** a saved connection in the list **When** I click the delete icon **Then** a confirmation prompt appears; confirming removes the record from DB and the list

10. **Given** multiple connections saved **When** viewing the list **Then** each row shows: connection name (e.g., `user@host:port`), auth method badge, and action icons (edit, delete, test)

11. **Given** any connection operation **When** it fails **Then** a toast error message appears via `sonner`

## Tasks / Subtasks

### Task 1: Add DB migration for `ssh_connections` table (AC: 7)

- [x] 1.1 Create `src-tauri/src/migration/m20260412_000002_ssh_connections.rs`:
  ```rust
  use sea_orm_migration::prelude::*;

  pub struct Migration;

  impl MigrationName for Migration {
      fn name(&self) -> &str {
          "m20260412_000002_ssh_connections"
      }
  }

  #[async_trait::async_trait]
  impl MigrationTrait for Migration {
      async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
          manager.get_connection().execute_unprepared(
              "CREATE TABLE IF NOT EXISTS ssh_connections (
                  id TEXT PRIMARY KEY NOT NULL,
                  host TEXT NOT NULL,
                  port INTEGER NOT NULL DEFAULT 22,
                  username TEXT NOT NULL,
                  auth_method TEXT NOT NULL CHECK(auth_method IN ('key', 'password')),
                  key_name TEXT,
                  created_at INTEGER NOT NULL
              )"
          ).await?;
          Ok(())
      }

      async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
          manager.get_connection().execute_unprepared(
              "DROP TABLE IF EXISTS ssh_connections"
          ).await?;
          Ok(())
      }
  }
  ```

- [x] 1.2 Register migration in `src-tauri/src/migration/mod.rs` — add `mod m20260412_000002_ssh_connections;` and push `Box::new(m20260412_000002_ssh_connections::Migration)` to the `migrations()` vec

### Task 2: Create SeaORM entity for `ssh_connections` (AC: 7, 8, 9)

- [x] 2.1 Create `src-tauri/src/db/entities/ssh_connection.rs`:
  ```rust
  use sea_orm::entity::prelude::*;

  #[derive(Clone, Debug, PartialEq, DeriveEntityModel, serde::Serialize, serde::Deserialize)]
  #[sea_orm(table_name = "ssh_connections")]
  pub struct Model {
      #[sea_orm(primary_key, auto_increment = false)]
      pub id: String,
      pub host: String,
      pub port: i32,
      pub username: String,
      /// "key" or "password"
      pub auth_method: String,
      /// Name of the SSH key from keychain (only when auth_method = "key")
      pub key_name: Option<String>,
      pub created_at: i64,
  }

  #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
  pub enum Relation {}

  impl ActiveModelBehavior for ActiveModel {}
  ```

- [x] 2.2 Add `pub mod ssh_connection;` to `src-tauri/src/db/entities/mod.rs`

### Task 3: Add SSH connection model types to `ssh_config.rs` (AC: 2–10)

- [x] 3.1 Add to `src-tauri/src/models/ssh_config.rs`:
  ```rust
  #[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq)]
  pub enum AuthMethod {
      Key,
      Password,
  }

  impl AuthMethod {
      pub fn as_str(&self) -> &str {
          match self {
              AuthMethod::Key => "key",
              AuthMethod::Password => "password",
          }
      }

      pub fn from_str(s: &str) -> Option<Self> {
          match s {
              "key" => Some(AuthMethod::Key),
              "password" => Some(AuthMethod::Password),
              _ => None,
          }
      }
  }

  /// A saved SSH connection profile (password never stored).
  #[derive(Debug, Clone, Serialize, Deserialize, Type)]
  pub struct SshConnectionProfile {
      pub id: String,
      pub host: String,
      pub port: u16,
      pub username: String,
      pub auth_method: String,  // "key" | "password"
      pub key_name: Option<String>,
      pub created_at: i64,
  }

  #[derive(Debug, Clone, Serialize, Deserialize, Type)]
  pub struct CreateSshConnectionInput {
      pub host: String,
      pub port: u16,
      pub username: String,
      pub auth_method: String,   // "key" | "password"
      pub key_name: Option<String>,
  }

  #[derive(Debug, Clone, Serialize, Deserialize, Type)]
  pub struct UpdateSshConnectionInput {
      pub id: String,
      pub host: String,
      pub port: u16,
      pub username: String,
      pub auth_method: String,
      pub key_name: Option<String>,
  }

  #[derive(Debug, Clone, Serialize, Deserialize, Type)]
  pub struct TestSshConnectionInput {
      pub host: String,
      pub port: u16,
      pub username: String,
      pub auth_method: String,   // "key" | "password"
      pub key_name: Option<String>,
      /// Only present for password auth (never stored in DB)
      pub password: Option<String>,
  }

  #[derive(Debug, Clone, Serialize, Deserialize, Type)]
  pub struct SshConnectionTestResult {
      pub success: bool,
      /// SHA256 host fingerprint — present on success
      pub fingerprint: Option<String>,
      /// Error description — present on failure
      pub error: Option<String>,
  }
  ```

### Task 4: Create SSH connection Tauri commands (AC: 1, 5, 7, 8, 9)

- [x] 4.1 Create `src-tauri/src/commands/ssh_connections.rs` with these commands:

  **`list_ssh_connections`** — reads all rows from `ssh_connections` table, maps to `SshConnectionProfile`

  **`create_ssh_connection`** — validates input (host non-empty, port 1–65535, username non-empty, auth_method valid, key_name required if auth_method="key"), generates UUID id, inserts row, returns `SshConnectionProfile`

  **`update_ssh_connection`** — validates same as create, finds row by id (returns `AppError::NotFound` if missing), updates all fields, returns updated `SshConnectionProfile`

  **`delete_ssh_connection`** — finds row by id (returns `AppError::NotFound` if missing), deletes it, returns `()`

  **`test_ssh_connection`** — attempts SSH handshake via russh (see Task 5 for service); returns `SshConnectionTestResult` within 5s timeout; auth logic: if "key" retrieve private PEM from keyring via `ssh_service::export_key`, if "password" use provided password field

  All commands:
  - `#[tauri::command]` + `#[specta::specta]`
  - `async fn … (db: State<'_, DatabaseConnection>) -> Result<T, AppError>`
  - Use `tracing::warn!` for non-fatal issues, never `println!`
  - Never `unwrap()` in production paths

- [x] 4.2 Add `pub mod ssh_connections;` to `src-tauri/src/commands/mod.rs`

### Task 5: Implement SSH connection test service logic (AC: 5, 6)

- [x] 5.1 Add `test_connection` function to `src-tauri/src/services/ssh_service.rs`:
  ```rust
  use russh::{client, ChannelMsg};
  use russh_keys::key::PublicKey;
  use std::sync::Arc;
  use tokio::time::{timeout, Duration};

  /// Test SSH connection — connect, handshake, authenticate, return fingerprint.
  /// Timeout: 5 seconds total. Password is None for key-auth.
  pub async fn test_connection(
      host: &str,
      port: u16,
      username: &str,
      auth_method: &str,  // "key" | "password"
      key_name: Option<&str>,
      password: Option<&str>,
  ) -> Result<SshConnectionTestResult, AppError> {
      // ... implementation using russh 0.60.0 client API
      // See russh docs: https://docs.rs/russh/0.60.0
      // Key steps:
      // 1. Wrap in tokio::time::timeout(Duration::from_secs(5), ...)
      // 2. Create client::Config (default) and Arc::new it
      // 3. client::connect(config, (host, port), Handler).await
      //    - Handler implements client::Handler: check_server_key captures fingerprint
      // 4. If auth="key": retrieve PEM via export_key(key_name), parse with ssh_key crate, authenticate
      // 5. If auth="password": session.authenticate_password(username, password).await
      // 6. Disconnect after auth check
      // 7. Return SshConnectionTestResult { success, fingerprint, error }
  }
  ```

  **russh 0.60.0 API (critical — do NOT guess):**
  - `client::Config` — use `Default::default()`
  - `client::connect(Arc<client::Config>, addr, handler) -> Result<client::Handle<H>, _>`
  - Handler trait: implement `client::Handler` with `check_server_key(server_public_key: &ssh_key::PublicKey) -> Result<bool, _>`
  - Capture fingerprint from `server_public_key.fingerprint(HashAlg::Sha256).to_string()`
  - Authenticate with SSH key: `handle.authenticate_publickey(username, PrivateKeyWithHashAlg::new(Arc::new(key_pair), None)).await`
    - Parse private key PEM: `ssh_key::PrivateKey::from_openssh(pem_bytes)` (ssh-key 0.6 crate already in Cargo.toml)
  - Authenticate with password: `handle.authenticate_password(username, password).await`
  - Check auth result: returns `bool` (true = success)
  - Disconnect: `handle.disconnect(russh::Disconnect::ByApplication, "", "").await`
  - `HashAlg` from `ssh_key::HashAlg`

  **Import the `ssh_key` crate** (already in Cargo.toml as `ssh-key = { version = "0.6", features = ["ed25519", "encryption", "std"] }`).
  Note: `rand = "0.8"` is also available in Cargo.toml.

### Task 6: Register new commands in `lib.rs` (AC: all)

- [x] 6.1 In `src-tauri/src/lib.rs`, add to `collect_commands!` macro:
  ```rust
  commands::ssh_connections::list_ssh_connections,
  commands::ssh_connections::create_ssh_connection,
  commands::ssh_connections::update_ssh_connection,
  commands::ssh_connections::delete_ssh_connection,
  commands::ssh_connections::test_ssh_connection,
  ```

### Task 7: Regenerate TypeScript bindings (AC: all frontend)

- [x] 7.1 Run `npm run tauri dev` to trigger tauri-specta binding regeneration → `src/bindings.ts` gets new command + type signatures
- [x] 7.2 Verify `src/bindings.ts` has the 5 new ssh_connections commands and all new types (`SshConnectionProfile`, `CreateSshConnectionInput`, `UpdateSshConnectionInput`, `TestSshConnectionInput`, `SshConnectionTestResult`)

### Task 8: Build SSH Connections UI panel (AC: 1–11)

> 🎨 FRONTEND/UI STORY: MUST use `/frontend-design` skill BEFORE writing any UI code.
>
> Call `/frontend-design` with: "SSH Connection Management panel for TinSu desktop app (Tauri). Dark theme. Tech stack: React 19, TypeScript, Tailwind v4, shadcn/ui. The panel shows a list of saved SSH connection profiles (host, port, user, auth method badge). Has an 'Add Connection' button. Each row has edit/delete/test action icons. An AddConnectionDialog has fields: Host (text input), Port (number, default 22), Username (text), Auth Method (Select: SSH Key | Password). If SSH Key: show a Select dropdown populated from `commands.listSshKeys()`. If Password: show a password input (not stored). A 'Test Connection' button shows inline status (spinner during test, green checkmark + fingerprint on success, red error on failure). Save/Cancel buttons in dialog footer."

- [x] 8.1 Create `src/components/settings/SshConnectionsPanel.tsx`:
  - `useQuery` from `@tanstack/react-query` for `commands.listSshConnections()`
  - `useMutation` from `@tanstack/react-query` for `commands.createSshConnection()`, `commands.updateSshConnection()`, `commands.deleteSshConnection()`, `commands.testSshConnection()`
  - Toast via `import { toast } from 'sonner'`
  - Import `commands` from `@renderer/lib/rspc`
  - Pattern: check `result.status === 'error'` and throw `new Error(JSON.stringify(result.error))`
  - Query key: `['ssh_connections']` — invalidate after create/update/delete mutations
  - For key auth dropdown: also call `commands.listSshKeys()` to populate key names
  - Delete: show `window.confirm()` or `AlertDialog` (shadcn/ui) before deleting
  - Test connection: call mutation on-click, show inline status (not toast — show in dialog)

- [x] 8.2 Add `SshConnectionsPanel` to `src/components/dialogs/SettingsDialog.tsx`:
  ```tsx
  import { SshConnectionsPanel } from '@renderer/components/settings/SshConnectionsPanel'
  // ...
  <hr className="border-border" />
  <SshConnectionsPanel />
  ```

### Task 9: Write Rust tests (AC: 5, 7)

- [x] 9.1 Add `#[cfg(test)] mod tests` in `src-tauri/src/commands/ssh_connections.rs`:
  - Test: `create_ssh_connection` rejects empty host
  - Test: `create_ssh_connection` rejects port 0 and port 65536
  - Test: `create_ssh_connection` rejects empty username
  - Test: `create_ssh_connection` rejects key auth with no key_name
  - Test: `create_ssh_connection` rejects unknown auth_method

- [x] 9.2 Add test in `src-tauri/src/services/ssh_service.rs`:
  - Test: `test_connection` to `127.0.0.1:1` (unroutable port) returns `success: false` within timeout — validates timeout behavior without a live SSH server; mark with `#[tokio::test]`

### Task 10: Write frontend tests (AC: 1–11)

- [x] 10.1 Create `src/components/settings/SshConnectionsPanel.test.tsx`:
  - Mock `commands` from `@renderer/lib/rspc` (follow existing test patterns in `AgentSettingsPanel.test.tsx`)
  - Test: renders loading skeleton when query pending
  - Test: renders empty state with "Add Connection" button when no connections
  - Test: renders list of connections with correct fields and action icons
  - Test: opens AddConnectionDialog on "Add Connection" click
  - Test: port field defaults to 22
  - Test: shows key selector when auth method is "SSH Key"
  - Test: shows password field when auth method is "Password"
  - Test: calls `createSshConnection` on save and invalidates query
  - Test: calls `deleteSshConnection` after confirmation
  - Test: shows test result inline (success fingerprint / error message)

## Dev Notes

### Critical Architecture Rules

**This story MUST NOT use tRPC.** The entire Tauri app uses tauri-specta bindings (`src/bindings.ts`) via the `commands` export from `@renderer/lib/rspc`. tRPC was deprecated in the Electron→Tauri migration (commit `f49cb0d`). Do NOT import `trpc` for any new SSH connection code.

**Command invocation pattern (from `useProjectCommands.ts`):**
```ts
import { commands } from '@renderer/lib/rspc'

const result = await commands.listSshConnections()
if (result.status === 'error') throw new Error(JSON.stringify(result.error))
return result.data
```

**React Query mutation pattern:**
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const queryClient = useQueryClient()
const mutation = useMutation({
  mutationFn: async (input: CreateSshConnectionInput) => {
    const result = await commands.createSshConnection(input)
    if (result.status === 'error') throw new Error(JSON.stringify(result.error))
    return result.data
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['ssh_connections'] })
    toast.success('Connection saved')
  },
  onError: (error) => {
    toast.error('Failed to save connection', { description: error.message })
  },
})
```

### File Structure Changes

```
src-tauri/
├── src/
│   ├── lib.rs                              ← ADD: 5 ssh_connections commands
│   ├── commands/
│   │   ├── mod.rs                          ← ADD: pub mod ssh_connections
│   │   └── ssh_connections.rs              ← NEW: 5 Tauri commands
│   ├── services/
│   │   └── ssh_service.rs                  ← ADD: test_connection() fn
│   ├── models/
│   │   └── ssh_config.rs                   ← ADD: new types
│   ├── db/
│   │   └── entities/
│   │       ├── mod.rs                      ← ADD: pub mod ssh_connection
│   │       └── ssh_connection.rs           ← NEW: SeaORM entity
│   └── migration/
│       ├── mod.rs                          ← ADD: new migration
│       └── m20260412_000002_ssh_connections.rs  ← NEW: migration
src/
├── bindings.ts                             ← AUTO-GENERATED
├── components/
│   ├── dialogs/
│   │   └── SettingsDialog.tsx              ← ADD: SshConnectionsPanel import + section
│   └── settings/
│       ├── SshConnectionsPanel.tsx         ← NEW: main panel
│       └── SshConnectionsPanel.test.tsx    ← NEW: tests
```

### Existing Code to Reuse

- **`ssh_service::export_key(name)`** — already implemented in T2.1 (`src-tauri/src/services/ssh_service.rs`). Use this to retrieve PEM for key-auth test connections.
- **`commands::list_ssh_keys`** — already implemented in T2.1. Call from frontend to populate key selector dropdown in Add Connection dialog.
- **`AppError` variants**: `AppError::NotFound`, `AppError::BadRequest`, `AppError::Internal` — use these; do NOT create new error types.
- **`now_unix_secs()`** — defined in `src-tauri/src/commands/project.rs`. Duplicate it as a private helper in `ssh_connections.rs` (same pattern — don't import across command modules; each defines its own `now_unix_secs` per existing project pattern).
- **`uuid::Uuid::new_v4().to_string()`** — UUID generation pattern used throughout; check `src-tauri/Cargo.toml` for uuid dependency (look for `uuid` crate; if not present, use `KEYCHAIN_SERVICE` pattern from ssh_service or add uuid dep).
- **`AgentSettingsPanel.test.tsx`** — reference for how settings panel tests are structured with mocked `trpc` queries. Adapt for `commands` mock pattern (commands are imported from `@renderer/lib/rspc`).

### russh 0.60.0 Critical Notes

- `russh = "0.60.0"` is already in `src-tauri/Cargo.toml` (added in T2.1).
- `ssh-key = { version = "0.6", ... }` is already in Cargo.toml (used in T2.1 for key generation).
- The architecture specifies `russh 0.54.6` but the actual T2.1 implementation used `russh 0.60.0` (latest compatible). Stick with 0.60.0.
- russh 0.60.0 uses `async_trait` internally; all client handler impls must be `#[async_trait]`.
- Handler check_server_key result determines whether to accept the host. For test connection, **always accept** (return `Ok(true)`) and capture the fingerprint.
- The server public key fingerprint: `server_public_key.fingerprint(ssh_key::HashAlg::Sha256)` returns a `Fingerprint` struct; call `.to_string()` for `"SHA256:..."` format.

### Database Schema Notes

- Port stored as `INTEGER` in SQLite (SeaORM maps to `i32`); validate 1–65535 in Rust before insert.
- `auth_method` stored as TEXT with CHECK constraint; only "key" or "password" values allowed.
- `key_name` is NULL when auth_method = "password".
- `id` is a TEXT UUID primary key (not auto-increment) — use `uuid::Uuid::new_v4().to_string()`.
- **Check if `uuid` crate is in Cargo.toml** before using it. If not present, look for an alternative UUID source or add `uuid = { version = "1", features = ["v4"] }`.

### Rust Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Command file | snake_case | `ssh_connections.rs` |
| Entity file | snake_case | `ssh_connection.rs` (singular) |
| Structs | PascalCase | `SshConnectionProfile`, `CreateSshConnectionInput` |
| Commands | snake_case | `list_ssh_connections`, `test_ssh_connection` |
| Constants | SCREAMING_SNAKE_CASE | `AUTH_METHOD_KEY` (if needed) |
| Tests | `#[cfg(test)] mod tests` co-located | |

### Error Handling Rules (Same as T2.1)

- Use `?` operator with `.map_err(|e| AppError::...)` for external errors
- Invalid input → `AppError::BadRequest` with descriptive message
- DB row not found → `AppError::NotFound`
- Internal/unexpected errors → `AppError::Internal`
- NEVER `unwrap()` in production paths
- NEVER `println!` — use `tracing::warn!`, `tracing::error!`

### Testing Requirements

- All Rust tests in `#[cfg(test)] mod tests` co-located with source (not in `tests/` dir)
- `cargo test` must pass with 0 failures
- Minimum 5 Rust tests: 4 validation tests + 1 timeout/failure test for `test_connection`
- Frontend tests with Vitest (`npm run test` must pass)
- Mock pattern for `commands`: follow existing test files in `src/components/settings/`

### Previous Story Context (T2.1 Patterns to Follow)

From T2.1:
- Specta derives: every DTO needs `#[derive(Debug, Clone, Serialize, Deserialize, Type)]`
- All commands are `async fn` returning `Result<T, AppError>`
- `#[tauri::command]` AND `#[specta::specta]` both required on every command
- Commands receive DB via `db: State<'_, DatabaseConnection>` (already managed, no new State needed)
- `collect_commands!` macro in `lib.rs` registers commands by `module::function` path
- `settings::Entity` `ActiveModel` pattern with `Set(value)` for upsert — follow same for `ssh_connection::Entity`
- Avoid TOCTOU in concurrent writes (single-user desktop, acceptable; document if deferring)
- keyring `Entry::new(KEYCHAIN_SERVICE, key_name)` to retrieve key for test_connection auth

### Architecture Source References

- SSH connection table design: `_bmad-output/planning-artifacts/architecture.md` → "New tables (SSH connections, remote projects) added in Phase 2"
- SshService interface: `_bmad-output/planning-artifacts/architecture.md` → "SshService: connect(), exec(), forward_port()"
- russh library: `_bmad-output/planning-artifacts/architecture.md` → "Key Rust Dependencies" table
- FR54 (SSH connection management): `_bmad-output/planning-artifacts/epics.md` → Epic 2, Story T2.2
- NFR33 (connection <5s): `_bmad-output/planning-artifacts/epics.md` → T2.2 AC
- Settings dialog pattern: `src/components/dialogs/SettingsDialog.tsx`
- Command pattern: `src/hooks/useProjectCommands.ts`
- SSH key commands (T2.1): `src-tauri/src/commands/ssh.rs`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

N/A — no persistent debug logs required.

### Completion Notes List

- russh 0.60.0 uses an internal forked `ssh-key` crate (`internal-russh-forked-ssh-key`) that is type-incompatible with the public `ssh-key = "0.6"`. All russh key types must use `russh::keys::*` (e.g. `russh::keys::PublicKey`, `russh::keys::HashAlg`, `russh::keys::PrivateKey`) — never `ssh_key::*` from the public crate.
- `authenticate_publickey` / `authenticate_password` return `AuthResult` enum (not `bool`); call `.success()` on the result.
- All error paths in `test_connection` return `Ok(SshConnectionTestResult { success: false, ... })` — never `Err(...)` — so any connectivity failure surfaces as a structured test result rather than a command error.
- `AlertDialog` (shadcn/ui) is not installed in this project; delete confirmation uses a plain `Dialog` instead.
- Frontend tests use a real `QueryClient` + `QueryClientProvider` wrapper (not mocking `@tanstack/react-query` globally), and switch to password auth to bypass key-name validation in forms.
- Sonner mock must spread args (`(...args) => mockFn(...args)`) to avoid `undefined` second-arg mismatch in `toHaveBeenCalledWith` assertions.

### File List

- `src-tauri/src/migration/m20260412_000002_ssh_connections.rs` (NEW)
- `src-tauri/src/migration/mod.rs` (MODIFIED — added migration)
- `src-tauri/src/db/entities/ssh_connection.rs` (NEW)
- `src-tauri/src/db/entities/mod.rs` (MODIFIED — added pub mod)
- `src-tauri/src/models/ssh_config.rs` (MODIFIED — added 6 types)
- `src-tauri/src/services/ssh_service.rs` (MODIFIED — added test_connection + TestHandler)
- `src-tauri/src/commands/ssh_connections.rs` (NEW — 5 commands + 7 unit tests)
- `src-tauri/src/commands/mod.rs` (MODIFIED — added pub mod)
- `src-tauri/src/lib.rs` (MODIFIED — registered 5 commands in collect_commands!)
- `src/bindings.ts` (MODIFIED — auto-regenerated with new commands + types)
- `src/lib/rspc.ts` (MODIFIED — exported 5 new types)
- `src/components/settings/SshConnectionsPanel.tsx` (NEW — Terminal Luxe UI)
- `src/components/settings/SshConnectionsPanel.test.tsx` (NEW — 12 tests)
- `src/components/dialogs/SettingsDialog.tsx` (MODIFIED — added SshConnectionsPanel)
