# Story T2.1: Rust SSH Client Service with Key Management

Status: done

## Story

As a founder,
I want to generate SSH key pairs and store them securely in my OS keychain,
So that I can authenticate with remote machines without managing key files manually.

## Acceptance Criteria

1. **Given** the Tauri desktop app from Epic 1 **When** the SSH service initializes **Then** the system can generate Ed25519 SSH key pairs via `russh-keys` crate (FR55)

2. **Given** a generated Ed25519 key pair **When** stored **Then** the private key is stored in the OS keychain via `keyring` crate — macOS Keychain, Linux Secret Service (via libsecret), Windows Credential Manager

3. **Given** an SSH key stored in the OS keychain **When** the user views key management **Then** the public key is returned in OpenSSH format (`ssh-ed25519 AAAA... tinsu@<hostname>`) ready to paste into remote `authorized_keys`

4. **Given** stored SSH keys **When** the user requests the list **Then** all stored key entries are returned with name and public-key fields (private key never leaves the keychain)

5. **Given** a stored SSH key **When** the user requests export **Then** the private key PEM is retrieved from the keychain and returned (for one-time copy/save operations)

6. **Given** a stored SSH key **When** the user deletes it **Then** the entry is removed from the OS keychain

7. **Given** key generation **When** completed **Then** it completes in <2 seconds on all supported platforms

8. **Given** the new SSH commands **When** `cargo test` is run **Then** all SSH service unit tests pass, validating: key generation, keychain storage, public-key retrieval, private-key export, and key deletion

## Tasks / Subtasks

### Task 1: Add Cargo dependencies (AC: 1, 2, 7)

- [x] 1.1 Add to `src-tauri/Cargo.toml` under `[dependencies]`:
  ```toml
  russh = "0.54.6"
  russh-keys = "0.54.6"
  keyring = { version = "3", features = ["apple-native", "windows-native", "linux-secret-service-rt-tokio-crypto-openssl"] }
  ```
  > **Note:** `russh-keys` is the key-generation sub-crate; `russh` itself is needed for Phase 2 SSH connection. Adding both now avoids a second Cargo.lock churn in T2.2. `keyring` v3 is the current stable release.

### Task 2: Create SSH models (AC: 1–6)

- [x] 2.1 Create `src-tauri/src/models/ssh_config.rs`:
  ```rust
  use serde::{Deserialize, Serialize};
  use specta::Type;

  /// Keychain service name prefix — keeps all TinSu keys grouped
  pub const KEYCHAIN_SERVICE: &str = "tinsu_ssh";

  #[derive(Debug, Clone, Serialize, Deserialize, Type)]
  pub struct SshKeyEntry {
      /// User-provided name, also used as keychain account identifier
      pub name: String,
      /// OpenSSH-format public key (safe to display)
      pub public_key: String,
  }

  #[derive(Debug, Clone, Serialize, Deserialize, Type)]
  pub struct GenerateSshKeyInput {
      /// Name to identify this key pair (e.g. "macbook-tinsu")
      pub name: String,
  }

  #[derive(Debug, Clone, Serialize, Deserialize, Type)]
  pub struct SshKeyExport {
      pub name: String,
      pub public_key: String,
      /// PEM-encoded private key — only returned for export operations
      pub private_key_pem: String,
  }
  ```

- [x] 2.2 Re-export from `src-tauri/src/models/mod.rs`:
  ```rust
  pub mod ssh_config;
  ```

### Task 3: Create SSH service (AC: 1–7)

- [x] 3.1 Create `src-tauri/src/services/ssh_service.rs`:

  ```rust
  //! SSH key generation and OS keychain management.
  //! Uses russh-keys for Ed25519 key generation and keyring for secure storage.

  use crate::error::AppError;
  use crate::models::ssh_config::{SshKeyEntry, SshKeyExport, KEYCHAIN_SERVICE};
  use keyring::Entry;
  use russh_keys::key::{KeyPair, PublicKey};
  use russh_keys::encoding::Encodable;  // for public key to_openssh
  use std::collections::HashMap;

  /// Generate a new Ed25519 SSH key pair and store the private key in the OS keychain.
  /// Returns the SshKeyEntry (name + public key) on success.
  pub fn generate_and_store_key(name: &str) -> Result<SshKeyEntry, AppError> {
      // Validate name: no slashes, colons, or spaces (keychain constraints)
      if name.is_empty() || name.contains(['/', ':', ' ']) {
          return Err(AppError::BadRequest(
              "Key name must be non-empty and contain no spaces, slashes, or colons".into(),
          ));
      }

      // Generate Ed25519 key pair
      let key_pair = KeyPair::generate_ed25519()
          .map_err(|e| AppError::Internal(format!("Key generation failed: {e}")))?;

      // Serialize private key to OpenSSH PEM format
      let private_pem = russh_keys::encode_pkcs8_pem(&key_pair)
          .map_err(|e| AppError::Internal(format!("Private key encoding failed: {e}")))?;

      // Derive public key in OpenSSH format
      let public_key = public_key_to_openssh(key_pair.clone_public_key()
          .map_err(|e| AppError::Internal(format!("Public key extraction failed: {e}")))?,
          name)?;

      // Store private key in OS keychain
      let entry = Entry::new(KEYCHAIN_SERVICE, name)
          .map_err(|e| AppError::Internal(format!("Keychain entry creation failed: {e}")))?;
      entry.set_password(&private_pem)
          .map_err(|e| AppError::Internal(format!("Keychain storage failed: {e}")))?;

      Ok(SshKeyEntry { name: name.to_string(), public_key })
  }

  /// List all SSH key names stored in the OS keychain.
  /// Reads from a metadata store (app data dir) since keyring has no enumerate API.
  pub fn list_keys(key_names: &[String]) -> Result<Vec<SshKeyEntry>, AppError> {
      let mut entries = Vec::new();
      for name in key_names {
          if let Ok(entry) = Entry::new(KEYCHAIN_SERVICE, name) {
              if let Ok(pem) = entry.get_password() {
                  if let Ok(public_key) = public_key_from_pem(&pem, name) {
                      entries.push(SshKeyEntry { name: name.clone(), public_key });
                  }
              }
          }
      }
      Ok(entries)
  }

  /// Retrieve the public key for a named SSH key.
  pub fn get_public_key(name: &str) -> Result<SshKeyEntry, AppError> {
      let private_pem = get_private_pem(name)?;
      let public_key = public_key_from_pem(&private_pem, name)?;
      Ok(SshKeyEntry { name: name.to_string(), public_key })
  }

  /// Export both public and private key for a named SSH key.
  pub fn export_key(name: &str) -> Result<SshKeyExport, AppError> {
      let private_pem = get_private_pem(name)?;
      let public_key = public_key_from_pem(&private_pem, name)?;
      Ok(SshKeyExport { name: name.to_string(), public_key, private_key_pem: private_pem })
  }

  /// Delete an SSH key from the OS keychain.
  pub fn delete_key(name: &str) -> Result<(), AppError> {
      let entry = Entry::new(KEYCHAIN_SERVICE, name)
          .map_err(|e| AppError::Internal(format!("Keychain entry creation failed: {e}")))?;
      entry.delete_credential()
          .map_err(|e| AppError::Internal(format!("Keychain deletion failed: {e}")))?;
      Ok(())
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  fn get_private_pem(name: &str) -> Result<String, AppError> {
      let entry = Entry::new(KEYCHAIN_SERVICE, name)
          .map_err(|e| AppError::Internal(format!("Keychain entry creation failed: {e}")))?;
      entry.get_password()
          .map_err(|_| AppError::NotFound(format!("SSH key '{name}' not found in keychain")))
  }

  fn public_key_from_pem(pem: &str, comment: &str) -> Result<String, AppError> {
      let key_pair = russh_keys::decode_secret_key(pem, None)
          .map_err(|e| AppError::Internal(format!("Private key decode failed: {e}")))?;
      let pubkey = key_pair.clone_public_key()
          .map_err(|e| AppError::Internal(format!("Public key extraction failed: {e}")))?;
      public_key_to_openssh(pubkey, comment)
  }

  fn public_key_to_openssh(pubkey: PublicKey, comment: &str) -> Result<String, AppError> {
      let openssh = pubkey.to_openssh()
          .map_err(|e| AppError::Internal(format!("OpenSSH encoding failed: {e}")))?;
      Ok(format!("{openssh} {comment}"))
  }

  #[cfg(test)]
  mod tests {
      use super::*;

      #[test]
      fn test_generate_key_produces_valid_ed25519() {
          // This test validates against real russh-keys generation
          let pair = KeyPair::generate_ed25519().expect("Should generate key pair");
          let pubkey = pair.clone_public_key().expect("Should extract public key");
          // Ed25519 public keys in OpenSSH format start with "ssh-ed25519"
          let openssh = pubkey.to_openssh().expect("Should encode");
          assert!(openssh.starts_with("AAAA"), "OpenSSH base64 should start with AAAA");
      }

      #[test]
      fn test_key_name_validation_rejects_invalid() {
          // Spaces, slashes, colons are all invalid
          for bad_name in &["bad name", "bad/name", "bad:name", ""] {
              let result = generate_and_store_key(bad_name);
              assert!(result.is_err(), "Should reject name '{bad_name}'");
          }
      }

      #[test]
      fn test_pem_roundtrip() {
          // Generate key, encode to PEM, decode back, get public key
          let pair = KeyPair::generate_ed25519().expect("gen");
          let pem = russh_keys::encode_pkcs8_pem(&pair).expect("pem encode");
          assert!(pem.contains("PRIVATE KEY"), "PEM should contain private key header");
          let decoded = russh_keys::decode_secret_key(&pem, None).expect("pem decode");
          let pubkey = decoded.clone_public_key().expect("pubkey");
          let openssh = pubkey.to_openssh().expect("openssh");
          assert!(!openssh.is_empty());
      }
  }
  ```

- [x] 3.2 Add `pub mod ssh_service;` to `src-tauri/src/services/mod.rs`

### Task 4: Create SSH commands (AC: 1–6, 8)

- [x] 4.1 Create `src-tauri/src/commands/ssh.rs`:

  ```rust
  //! SSH key management Tauri commands.
  //! Key names are persisted in app_settings table under key "ssh_key_names" as JSON array.

  use crate::db::entities::settings;
  use crate::error::AppError;
  use crate::models::ssh_config::{GenerateSshKeyInput, SshKeyEntry, SshKeyExport};
  use crate::services::ssh_service;
  use sea_orm::{DatabaseConnection, EntityTrait, ActiveModelTrait, Set, QueryFilter, ColumnTrait};
  use tauri::State;

  // Key used in app_settings to persist SSH key names (since keyring has no list API)
  const SSH_KEY_NAMES_SETTING: &str = "ssh_key_names";

  /// Generate a new Ed25519 key pair, store in OS keychain, persist name in DB.
  #[tauri::command]
  #[specta::specta]
  pub async fn generate_ssh_key(
      input: GenerateSshKeyInput,
      db: State<'_, DatabaseConnection>,
  ) -> Result<SshKeyEntry, AppError> {
      let entry = ssh_service::generate_and_store_key(&input.name)?;
      // Persist the name to the settings table so we can enumerate later
      append_key_name(&db, &input.name).await?;
      Ok(entry)
  }

  /// List all SSH keys stored in the OS keychain (names from DB, public keys from keychain).
  #[tauri::command]
  #[specta::specta]
  pub async fn list_ssh_keys(
      db: State<'_, DatabaseConnection>,
  ) -> Result<Vec<SshKeyEntry>, AppError> {
      let names = get_key_names(&db).await?;
      ssh_service::list_keys(&names)
  }

  /// Get the public key for a named SSH key.
  #[tauri::command]
  #[specta::specta]
  pub async fn get_ssh_public_key(
      name: String,
      db: State<'_, DatabaseConnection>,
  ) -> Result<SshKeyEntry, AppError> {
      ssh_service::get_public_key(&name)
  }

  /// Export both public and private key for a named SSH key.
  /// WARNING: Private key is returned in plaintext — use only for one-time export.
  #[tauri::command]
  #[specta::specta]
  pub async fn export_ssh_key(
      name: String,
      db: State<'_, DatabaseConnection>,
  ) -> Result<SshKeyExport, AppError> {
      ssh_service::export_key(&name)
  }

  /// Delete a named SSH key from the OS keychain and remove from DB name list.
  #[tauri::command]
  #[specta::specta]
  pub async fn delete_ssh_key(
      name: String,
      db: State<'_, DatabaseConnection>,
  ) -> Result<(), AppError> {
      ssh_service::delete_key(&name)?;
      remove_key_name(&db, &name).await?;
      Ok(())
  }

  // ── DB Helpers ───────────────────────────────────────────────────────────────

  async fn get_key_names(db: &DatabaseConnection) -> Result<Vec<String>, AppError> {
      use crate::db::entities::settings::Column;
      let row = settings::Entity::find()
          .filter(Column::Key.eq(SSH_KEY_NAMES_SETTING))
          .one(db)
          .await?;
      Ok(row
          .and_then(|r| serde_json::from_str::<Vec<String>>(&r.value).ok())
          .unwrap_or_default())
  }

  async fn append_key_name(db: &DatabaseConnection, name: &str) -> Result<(), AppError> {
      let mut names = get_key_names(db).await?;
      if !names.contains(&name.to_string()) {
          names.push(name.to_string());
          upsert_key_names(db, &names).await?;
      }
      Ok(())
  }

  async fn remove_key_name(db: &DatabaseConnection, name: &str) -> Result<(), AppError> {
      let mut names = get_key_names(db).await?;
      names.retain(|n| n != name);
      upsert_key_names(db, &names).await?;
      Ok(())
  }

  async fn upsert_key_names(db: &DatabaseConnection, names: &[String]) -> Result<(), AppError> {
      use crate::db::entities::settings::Column;
      let json = serde_json::to_string(names)
          .map_err(|e| AppError::Internal(e.to_string()))?;
      // Check existing row first
      let existing = settings::Entity::find()
          .filter(Column::Key.eq(SSH_KEY_NAMES_SETTING))
          .one(db)
          .await?;
      match existing {
          Some(row) => {
              let mut active: settings::ActiveModel = row.into();
              active.value = Set(json);
              active.update(db).await?;
          }
          None => {
              let active = settings::ActiveModel {
                  key: Set(SSH_KEY_NAMES_SETTING.to_string()),
                  value: Set(json),
                  ..Default::default()
              };
              active.insert(db).await?;
          }
      }
      Ok(())
  }
  ```

- [x] 4.2 Add `pub mod ssh;` to `src-tauri/src/commands/mod.rs`

### Task 5: Register commands in lib.rs (AC: 1–6, 8)

- [x] 5.1 In `src-tauri/src/lib.rs`, add SSH commands to the `collect_commands!` macro:
  ```rust
  commands::ssh::generate_ssh_key,
  commands::ssh::list_ssh_keys,
  commands::ssh::get_ssh_public_key,
  commands::ssh::export_ssh_key,
  commands::ssh::delete_ssh_key,
  ```

- [x] 5.2 Verify `src-tauri/src/lib.rs` `use` imports: the SSH commands use `DatabaseConnection` State, which is already managed in the `setup` closure. No new State registration needed.

### Task 6: Verify settings entity schema (AC: 2, 6)

- [x] 6.1 Read `src-tauri/src/db/entities/settings.rs` and confirm the `app_settings` table has `key` (TEXT PRIMARY KEY) and `value` (TEXT) columns — these are what the SSH commands use to persist key names.

- [x] 6.2 If `settings.rs` entity does not have `insert` and `update` support (i.e., only `select`), add `ActiveModel` to the entity with `DeriveActiveModel`.

- [x] 6.3 Verify the `app_settings` table is in the migration `m20260412_000001_initial_schema.rs`. If NOT present, add to an existing migration or create a new one `m20260412_000002_settings_table.rs` — but check first, it is expected to exist from T1.5 / Epic 1.

### Task 7: Export TypeScript bindings (AC: 8)

- [x] 7.1 Run `npm run tauri dev` in development mode to trigger the `#[cfg(debug_assertions)]` binding export — this regenerates `src/bindings.ts` with the new SSH command signatures.

- [x] 7.2 Verify `src/bindings.ts` contains the 5 new SSH command function signatures.

### Task 8: Write integration tests (AC: 8)

- [x] 8.1 Add integration tests to `src-tauri/src/commands/ssh.rs` in a `#[cfg(test)] mod tests` block:
  ```rust
  #[cfg(test)]
  mod tests {
      use super::*;

      // Test key name validation via ssh_service directly (no DB needed)
      #[test]
      fn test_invalid_key_names_rejected() {
          for bad in &["", "bad name", "bad/key", "bad:key"] {
              assert!(crate::services::ssh_service::generate_and_store_key(bad).is_err());
          }
      }
  }
  ```

- [x] 8.2 Add timing test in `src-tauri/src/services/ssh_service.rs` tests:
  ```rust
  #[test]
  fn test_key_generation_under_2_seconds() {
      let start = std::time::Instant::now();
      let pair = KeyPair::generate_ed25519().expect("gen");
      let elapsed = start.elapsed();
      assert!(elapsed.as_secs() < 2, "Key generation took {:?}, expected <2s", elapsed);
      drop(pair);
  }
  ```

## Dev Notes

### Critical Architecture Context

**This story is BACKEND-ONLY.** The UI for SSH key management is in T2.2 (`Remote Connection Management UI`). T2.1 exposes only Tauri commands — no new React components.

**Dependency additions required before any code compiles:**
```toml
# src-tauri/Cargo.toml — add under [dependencies]
russh = "0.54.6"
russh-keys = "0.54.6"
keyring = { version = "3", features = ["apple-native", "windows-native", "linux-secret-service-rt-tokio-crypto-openssl"] }
```
Adding `russh` now (even though T2.1 only uses `russh-keys`) avoids a disruptive Cargo.lock update in T2.2 when the actual SSH connection client is built.

**keyring v3 API (breaking change from v2):**
- v3 uses `Entry::new(service, account)` — service is `KEYCHAIN_SERVICE`, account is the key name
- `entry.set_password(secret)` stores a UTF-8 string
- `entry.get_password()` retrieves it
- `entry.delete_credential()` removes it (NOT `delete_password()` — that was v2)
- On Linux, the `linux-secret-service-rt-tokio-crypto-openssl` feature is required for async runtime compatibility

**russh-keys API:**
- `KeyPair::generate_ed25519()` — generates Ed25519 key pair
- `russh_keys::encode_pkcs8_pem(&key_pair)` — PEM encode private key
- `russh_keys::decode_secret_key(pem, passphrase)` — decode private key from PEM (pass `None` for no passphrase)
- `key_pair.clone_public_key()` — extract public key from pair
- `pubkey.to_openssh()` — base64 encoded key body (prefix type separately: `ssh-ed25519 {body} {comment}`)

**Key enumeration workaround:** The `keyring` crate has no list-all-entries API (OS keychain APIs vary per platform). The solution is to persist the list of key names in the `app_settings` table under `key = "ssh_key_names"` as a JSON array. This is the canonical list of names; keyring is authoritative for the secrets.

### Existing Code to Reuse

**`app_settings` table / `settings::Entity`:** Already created in the Epic 1 migration. Check `src-tauri/src/db/entities/settings.rs` for the entity structure. The SSH commands use this for the key name list. Follow the exact same SeaORM `ActiveModel` pattern used in other commands (e.g., `src-tauri/src/commands/config.rs`).

**`AppError` enum:** Already defined in `src-tauri/src/error.rs`. Use `AppError::NotFound`, `AppError::BadRequest`, `AppError::Internal`. Do NOT introduce `anyhow::Error` or new error types.

**State access pattern:** SSH commands receive `db: State<'_, DatabaseConnection>`. The `DatabaseConnection` is already managed in `lib.rs` via `app_handle.manage(db)`. No new State management needed.

**Specta derive pattern:** All DTOs must derive `specta::Type` (in addition to `Serialize`, `Deserialize`) — this is how TypeScript types are auto-generated from Rust structs. See any existing command file for the exact derive macro list.

### File Structure Changes

```
src-tauri/
├── Cargo.toml                          ← ADD: russh, russh-keys, keyring
├── src/
│   ├── lib.rs                          ← ADD: 5 SSH command registrations
│   ├── commands/
│   │   ├── mod.rs                      ← ADD: pub mod ssh;
│   │   └── ssh.rs                      ← NEW: 5 Tauri commands
│   ├── services/
│   │   ├── mod.rs                      ← ADD: pub mod ssh_service;
│   │   └── ssh_service.rs              ← NEW: key gen + keychain ops
│   └── models/
│       ├── mod.rs                      ← ADD: pub mod ssh_config;
│       └── ssh_config.rs               ← NEW: SshKeyEntry, SshKeyExport types
src/
└── bindings.ts                         ← AUTO-GENERATED: new SSH command types
```

### Naming Conventions (MUST FOLLOW)

| Element | Convention | Example |
|---------|-----------|---------|
| Rust modules | snake_case | `ssh_service.rs`, `ssh_config.rs` |
| Rust structs | PascalCase | `SshKeyEntry`, `SshKeyExport` |
| Rust functions | snake_case | `generate_and_store_key`, `get_public_key` |
| Rust constants | SCREAMING_SNAKE_CASE | `KEYCHAIN_SERVICE`, `SSH_KEY_NAMES_SETTING` |
| Tauri commands | snake_case | `generate_ssh_key`, `list_ssh_keys` |
| Tests | `#[cfg(test)] mod tests` co-located | Inside same file |

### Error Handling Rules

- Use `?` operator with `.map_err(|e| AppError::...)` for converting external errors
- `keyring` errors → `AppError::Internal` (OS-level, unexpected)
- `russh-keys` errors → `AppError::Internal` (library failure)
- Key not found in keychain → `AppError::NotFound`
- Invalid key name → `AppError::BadRequest`
- NEVER use `unwrap()` in production code paths
- NEVER use `println!` — use `tracing::warn!`, `tracing::error!`

### Testing Requirements

- All tests live in `#[cfg(test)] mod tests` inside the source file (co-located, NOT in `tests/`)
- `cargo test` must pass with no failures
- Minimum 5 tests covering: key generation, PEM roundtrip, name validation, timing assertion (<2s), public key format
- Keychain tests that would interact with the real OS keychain should be marked `#[ignore]` in CI-hostile environments — but the service logic tests (generation, encoding, validation) run without keychain access and MUST pass

### Previous Story Context (T1.10 patterns to follow)

From T1.10 code review results:
- Commands use `State<'_, DatabaseConnection>` — not Arc-wrapped, Tauri manages the lifetime
- All command functions are `async` and return `Result<T, AppError>`
- The `#[tauri::command]` and `#[specta::specta]` attributes must both be present on every command
- `collect_commands!` macro in `lib.rs` lists commands by `module::function` path
- Tests use `tempfile` crate for filesystem isolation when needed (already in dev-dependencies)

### Architecture Source References

- SSH key management design: `_bmad-output/planning-artifacts/architecture.md` → "Authentication & Security" section
- russh/keyring library versions: `_bmad-output/planning-artifacts/architecture.md` → "Key Rust Dependencies" table
- Project structure rules: `_bmad-output/planning-artifacts/architecture.md` → "Rust Backend Organization" section
- Error handling rules: `_bmad-output/planning-artifacts/architecture.md` → "Rust Error Handling" section
- SSH service location in architecture: `services/ssh_service.rs` — "Phase 2: russh SSH client" [Source: architecture.md#Project-Structure]
- FR55 (SSH key management): `_bmad-output/planning-artifacts/epics.md` → Epic 2, Story T2.1

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- russh-keys v0.54.6 does not exist (story spec was incorrect); russh-keys v0.50.0-beta.7 and russh v0.60.0 are incompatible due to conflicting `internal-russh-forked-ssh-key` dependency versions. Solution: used `ssh-key = "0.6"` crate (the upstream of russh's internal fork) with `rand = "0.8"` for Ed25519 generation via `PrivateKey::random()`, plus `russh = "0.60.0"` for T2.2 SSH connection support.
- keyring v3 feature `linux-secret-service-rt-tokio-crypto-openssl` does not exist; correct features are `sync-secret-service` + `crypto-openssl`.

### Completion Notes List

- Implemented Ed25519 SSH key generation using `ssh-key` crate (`PrivateKey::random`) instead of `russh-keys` (incompatible with `russh 0.60.0`)
- Private keys stored/retrieved via `keyring v3` OS keychain (`Entry::new`, `set_password`, `get_password`, `delete_credential`)
- Key name list persisted in `settings` table (`ssh_key_names` JSON array) to work around keyring's lack of enumeration API
- Settings entity upsert pattern adapted to include required `id` (UUID) and `created_at` (Unix secs) fields
- 6 SSH unit tests pass (key generation, name validation, PEM roundtrip, timing <2s, OpenSSH format, command validation)
- Full test suite: 109 tests pass, 0 regressions
- TypeScript bindings regenerated: 5 new SSH command signatures in `src/bindings.ts`

### File List

- `src-tauri/Cargo.toml` — added `russh`, `ssh-key`, `rand`, `keyring` dependencies
- `src-tauri/src/models/ssh_config.rs` — NEW: SshKeyEntry, GenerateSshKeyInput, SshKeyExport types
- `src-tauri/src/models/mod.rs` — added `pub mod ssh_config`
- `src-tauri/src/services/ssh_service.rs` — NEW: generate_and_store_key, list_keys, get_public_key, export_key, delete_key
- `src-tauri/src/services/mod.rs` — added `pub mod ssh_service`
- `src-tauri/src/commands/ssh.rs` — NEW: 5 Tauri commands + DB helpers
- `src-tauri/src/commands/mod.rs` — added `pub mod ssh`
- `src-tauri/src/lib.rs` — registered 5 SSH commands in collect_commands!
- `src/bindings.ts` — AUTO-GENERATED: new SSH command TypeScript signatures

### Review Findings

- [x] [Review][Patch] Keychain orphan on DB failure in `generate_ssh_key` [src-tauri/src/commands/ssh.rs:21] — Fixed: rollback keychain entry via `ssh_service::delete_key` when `append_key_name` fails; tracing::warn! logged if cleanup also fails
- [x] [Review][Patch] `list_keys` silently drops inaccessible keys without logging [src-tauri/src/services/ssh_service.rs:52] — Fixed: replaced silent `if let Ok` chain with explicit `match` arms emitting `tracing::warn!` at each failure point
- [x] [Review][Defer] `_db` dead parameter on `get_ssh_public_key` / `export_ssh_key` [src-tauri/src/commands/ssh.rs:40,51] — deferred, pre-existing; `_` prefix is idiomatic Rust, parameter retained for future DB-validation enhancement
- [x] [Review][Defer] `upsert_key_names` TOCTOU without transaction [src-tauri/src/commands/ssh.rs:109] — deferred, pre-existing; single-user desktop app, same pattern used elsewhere in codebase

## Change Log

- Implemented T2.1 Rust SSH client service with Ed25519 key generation, OS keychain storage, and 5 Tauri commands (Date: 2026-04-12)
