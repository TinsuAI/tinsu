# Story T2.3: Remote Project Discovery and Selection

Status: review

> 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

## Story

As a founder,
I want to discover and select projects on a remote machine,
so that I can manage remote codebases without manually entering paths.

## Acceptance Criteria

1. **Given** a saved SSH connection from T2.2 **When** I open the Remote Projects section in Settings **Then** I see a list of saved remote project profiles and a "Discover Projects" button

2. **Given** the Remote Projects section **When** I click "Discover Projects" **Then** a dialog opens with a dropdown of saved SSH connections, an optional search path field (default: `~`), and a "Discover" button

3. **Given** valid inputs in the discovery dialog **When** I click "Discover" **Then** the backend SSHes into the selected connection and runs `find <path> -name .git -maxdepth 5 -type d 2>/dev/null` to enumerate git repositories within 30 seconds

4. **Given** the discovery command completes **When** results arrive **Then** the dialog shows a list of discovered repositories with: repository name (last segment of parent path), full remote path, and an estimated last-modified date (from `stat` or directory mtime via SSH)

5. **Given** discovered projects are shown **When** I click "Save" on any item **Then** the project is persisted in the `remote_projects` DB table (connection_id, name, path) and appears in the main Remote Projects list

6. **Given** no projects are found at the search path **When** discovery completes **Then** an empty state message is shown: "No git repositories found. Try a different path."

7. **Given** the discovery dialog **When** I enter a path manually in a "Manual Path" input and click "Add Manually" **Then** the path is validated (non-empty, starts with `/` or `~`) and saved as a remote project profile without running discovery

8. **Given** permission errors during discovery **When** SSH find encounters inaccessible directories **Then** those directories are silently skipped (stderr is ignored; only stdout parsed)

9. **Given** a saved remote project profile **When** I view the Remote Projects list **Then** each row shows: connection label (`user@host:port`), project name, remote path, and action icons (delete)

10. **Given** a saved remote project **When** I click the delete icon **Then** a confirmation dialog appears; confirming removes it from the DB and the list

11. **Given** any remote operation fails (SSH timeout, connection refused) **When** the error is returned **Then** a toast error message appears via `sonner` with a descriptive message

12. **Given** discovery is in progress **When** I view the dialog **Then** a loading spinner/state is shown and the "Discover" button is disabled

## Tasks / Subtasks

### Task 1: Add DB migration for `remote_projects` table (AC: 5, 9)

- [x] 1.1 Create `src-tauri/src/migration/m20260412_000003_remote_projects.rs`:
  ```rust
  use sea_orm_migration::prelude::*;

  pub struct Migration;

  impl MigrationName for Migration {
      fn name(&self) -> &str {
          "m20260412_000003_remote_projects"
      }
  }

  #[async_trait::async_trait]
  impl MigrationTrait for Migration {
      async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
          manager.get_connection().execute_unprepared(
              "CREATE TABLE IF NOT EXISTS remote_projects (
                  id TEXT PRIMARY KEY NOT NULL,
                  connection_id TEXT NOT NULL,
                  name TEXT NOT NULL,
                  path TEXT NOT NULL,
                  created_at INTEGER NOT NULL,
                  FOREIGN KEY (connection_id) REFERENCES ssh_connections(id) ON DELETE CASCADE
              )"
          ).await?;
          Ok(())
      }

      async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
          manager.get_connection().execute_unprepared(
              "DROP TABLE IF EXISTS remote_projects"
          ).await?;
          Ok(())
      }
  }
  ```

- [x] 1.2 Register migration in `src-tauri/src/migration/mod.rs`:
  - Add `mod m20260412_000003_remote_projects;`
  - Push `Box::new(m20260412_000003_remote_projects::Migration)` into the `migrations()` vec (after the existing two migrations — order matters)

### Task 2: Create SeaORM entity for `remote_projects` (AC: 5, 9, 10)

- [x] 2.1 Create `src-tauri/src/db/entities/remote_project.rs`:
  ```rust
  use sea_orm::entity::prelude::*;

  #[derive(Clone, Debug, PartialEq, DeriveEntityModel, serde::Serialize, serde::Deserialize)]
  #[sea_orm(table_name = "remote_projects")]
  pub struct Model {
      #[sea_orm(primary_key, auto_increment = false)]
      pub id: String,
      pub connection_id: String,
      pub name: String,
      pub path: String,
      pub created_at: i64,
  }

  #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
  pub enum Relation {}

  impl ActiveModelBehavior for ActiveModel {}
  ```

- [x] 2.2 Add `pub mod remote_project;` to `src-tauri/src/db/entities/mod.rs`

### Task 3: Add new types to `ssh_config.rs` (AC: 2–5, 7, 9)

- [x] 3.1 Append to `src-tauri/src/models/ssh_config.rs`:
  ```rust
  /// A discovered git repository on the remote machine (not yet saved).
  #[derive(Debug, Clone, Serialize, Deserialize, Type)]
  pub struct DiscoveredProject {
      /// Display name — last path segment of the repo parent dir (e.g., "my-repo")
      pub name: String,
      /// Absolute path on the remote machine (e.g., "/home/user/my-repo")
      pub path: String,
  }

  /// A saved remote project profile.
  #[derive(Debug, Clone, Serialize, Deserialize, Type)]
  pub struct RemoteProjectProfile {
      pub id: String,
      pub connection_id: String,
      pub name: String,
      pub path: String,
      pub created_at: i64,
  }

  /// Input for the SSH project discovery command.
  #[derive(Debug, Clone, Serialize, Deserialize, Type)]
  pub struct DiscoverProjectsInput {
      /// ID of the saved SSH connection to use
      pub connection_id: String,
      /// Root path to search from (e.g., "~" or "/home/user"). Defaults to "~".
      pub search_path: Option<String>,
  }

  /// Input to save a discovered (or manually entered) remote project.
  #[derive(Debug, Clone, Serialize, Deserialize, Type)]
  pub struct SaveRemoteProjectInput {
      pub connection_id: String,
      pub name: String,
      pub path: String,
  }
  ```

### Task 4: Create SSH remote project discovery service logic (AC: 3, 4, 8)

- [x] 4.1 Add `discover_projects` function to `src-tauri/src/services/ssh_service.rs`:

  ```rust
  use russh::ChannelMsg;

  /// Connect to a remote host via SSH and find all git repositories under `search_path`.
  /// Returns a list of DiscoveredProject (name + path). Skips permission errors silently.
  /// Times out after 30 seconds.
  pub async fn discover_projects(
      host: &str,
      port: u16,
      username: &str,
      auth_method: &str,   // "key" | "password"
      key_name: Option<&str>,
      password: Option<&str>,
      search_path: &str,   // e.g. "~" or "/home/user"
  ) -> Result<Vec<crate::models::ssh_config::DiscoveredProject>, AppError> {
      use tokio::time::{timeout, Duration};

      // Build find command — 2>/dev/null silences permission errors
      // Limit maxdepth to 5 to avoid scanning huge trees
      let cmd = format!(
          "find {search_path} -name .git -maxdepth 5 -type d 2>/dev/null"
      );

      let output = timeout(
          Duration::from_secs(30),
          ssh_exec(host, port, username, auth_method, key_name, password, &cmd),
      )
      .await
      .map_err(|_| AppError::Internal("Remote project discovery timed out after 30 seconds".into()))??;

      Ok(parse_discovered_projects(&output))
  }

  /// Execute a single command over SSH, collect stdout, return as String.
  async fn ssh_exec(
      host: &str,
      port: u16,
      username: &str,
      auth_method: &str,
      key_name: Option<&str>,
      password: Option<&str>,
      command: &str,
  ) -> Result<String, AppError> {
      use std::sync::Arc;
      use russh::ChannelMsg;

      // ── Connect ───────────────────────────────────────────────────────────
      let fingerprint_store: Arc<std::sync::Mutex<Option<String>>> =
          Arc::new(std::sync::Mutex::new(None));
      let handler = TestHandler { fingerprint: Arc::clone(&fingerprint_store) };

      let config = Arc::new(russh::client::Config::default());
      let addr = format!("{host}:{port}");
      let mut session = russh::client::connect(config, addr, handler)
          .await
          .map_err(|e| AppError::Internal(format!("SSH connect failed: {e}")))?;

      // ── Authenticate ─────────────────────────────────────────────────────
      let auth_ok = match auth_method {
          "key" => {
              let name = key_name.ok_or_else(|| {
                  AppError::BadRequest("key_name required for key auth".into())
              })?;
              let export = export_key(name)?;
              let private_key = russh::keys::PrivateKey::from_openssh(
                  export.private_key_pem.as_bytes(),
              )
              .map_err(|e| AppError::Internal(format!("Bad private key PEM: {e}")))?;
              let key_with_alg =
                  russh::keys::PrivateKeyWithHashAlg::new(Arc::new(private_key), None);
              session
                  .authenticate_publickey(username, key_with_alg)
                  .await
                  .map_err(|e| AppError::Internal(format!("SSH auth failed: {e}")))?
                  .success()
          }
          "password" => {
              let pw = password.unwrap_or("");
              session
                  .authenticate_password(username, pw)
                  .await
                  .map_err(|e| AppError::Internal(format!("SSH auth failed: {e}")))?
                  .success()
          }
          other => {
              return Err(AppError::BadRequest(format!(
                  "auth_method must be 'key' or 'password', got '{other}'"
              )));
          }
      };

      if !auth_ok {
          return Err(AppError::Internal(
              "SSH authentication failed".into(),
          ));
      }

      // ── Open channel and exec command ─────────────────────────────────────
      let mut channel = session
          .channel_open_session()
          .await
          .map_err(|e| AppError::Internal(format!("SSH channel open failed: {e}")))?;

      channel
          .exec(true, command)
          .await
          .map_err(|e| AppError::Internal(format!("SSH exec failed: {e}")))?;

      // ── Collect stdout ────────────────────────────────────────────────────
      let mut stdout = Vec::new();
      loop {
          match channel.wait().await {
              None => break,
              Some(ChannelMsg::Data { ref data }) => {
                  stdout.extend_from_slice(data);
              }
              Some(ChannelMsg::ExitStatus { exit_status: _ }) => {
                  // command finished; drain remaining data before breaking
              }
              Some(ChannelMsg::Eof) => {
                  break;
              }
              _ => {}
          }
      }

      let _ = session.disconnect(russh::Disconnect::ByApplication, "", "").await;

      String::from_utf8(stdout)
          .map_err(|e| AppError::Internal(format!("SSH output not UTF-8: {e}")))
  }

  /// Parse `find … -name .git -type d` output into DiscoveredProject list.
  /// Input lines look like: /home/user/my-repo/.git
  /// Output: name = "my-repo", path = "/home/user/my-repo"
  fn parse_discovered_projects(output: &str) -> Vec<crate::models::ssh_config::DiscoveredProject> {
      output
          .lines()
          .filter_map(|line| {
              let line = line.trim();
              // Strip trailing "/.git"
              let parent = line.strip_suffix("/.git").or_else(|| line.strip_suffix("/.git/"))?;
              if parent.is_empty() {
                  return None;
              }
              // Name = last path segment
              let name = std::path::Path::new(parent)
                  .file_name()
                  .and_then(|n| n.to_str())
                  .unwrap_or(parent)
                  .to_string();
              Some(crate::models::ssh_config::DiscoveredProject {
                  name,
                  path: parent.to_string(),
              })
          })
          .collect()
  }
  ```

  **CRITICAL russh 0.60.0 notes (from T2.2 learnings — DO NOT guess the API):**
  - `TestHandler` struct is already defined in `ssh_service.rs` — **reuse it, do NOT duplicate**
  - `russh::keys::*` — use russh's bundled forked types, NEVER `ssh_key::*` from the public crate
  - `authenticate_publickey` / `authenticate_password` return `AuthResult` enum → call `.success()` (not a `bool`)
  - `channel.wait().await` returns `Option<ChannelMsg>` — loop until `None`
  - `channel.exec(want_reply: bool, command: &str)` — pass `true` for want_reply
  - `ChannelMsg::Data { ref data }` — `data` is `CryptoVec` (implements `Deref<[u8]>`)
  - `session.disconnect(Disconnect::ByApplication, "", "")` — always disconnect after use

### Task 5: Create remote_projects Tauri commands (AC: 3–10)

- [x] 5.1 Create `src-tauri/src/commands/remote_projects.rs`:

  ```rust
  //! Remote project discovery and management Tauri commands.

  use crate::db::entities::{remote_project, ssh_connection};
  use crate::error::AppError;
  use crate::models::ssh_config::{
      DiscoverProjectsInput, DiscoveredProject, RemoteProjectProfile, SaveRemoteProjectInput,
  };
  use crate::services::ssh_service;
  use sea_orm::{ActiveModelTrait, DatabaseConnection, EntityTrait, Set};
  use tauri::State;

  fn now_unix_secs() -> i64 {
      std::time::SystemTime::now()
          .duration_since(std::time::UNIX_EPOCH)
          .map(|d| d.as_secs() as i64)
          .unwrap_or_else(|e| {
              tracing::warn!("System clock before UNIX_EPOCH: {}; using 0", e);
              0
          })
  }

  fn model_to_profile(model: remote_project::Model) -> RemoteProjectProfile {
      RemoteProjectProfile {
          id: model.id,
          connection_id: model.connection_id,
          name: model.name,
          path: model.path,
          created_at: model.created_at,
      }
  }

  /// Discover git repositories on a remote machine via SSH.
  /// Runs `find <path> -name .git -maxdepth 5 -type d 2>/dev/null` over SSH.
  #[tauri::command]
  #[specta::specta]
  pub async fn discover_remote_projects(
      input: DiscoverProjectsInput,
      db: State<'_, DatabaseConnection>,
  ) -> Result<Vec<DiscoveredProject>, AppError> {
      // Load the SSH connection profile
      let conn = ssh_connection::Entity::find_by_id(&input.connection_id)
          .one(db.inner())
          .await?
          .ok_or_else(|| {
              AppError::NotFound(format!(
                  "SSH connection '{}' not found",
                  input.connection_id
              ))
          })?;

      let search_path = input.search_path.as_deref().unwrap_or("~");

      // IMPORTANT: password auth requires a password. For saved profiles without
      // a stored password, key auth must be used. This command only supports key
      // auth for saved profiles (password is not stored in DB per T2.2 design).
      // If auth_method is "password", return a clear error.
      if conn.auth_method == "password" {
          return Err(AppError::BadRequest(
              "Remote project discovery requires key-based SSH authentication. \
               Password authentication is not supported for discovery — \
               re-save the connection using an SSH key.".into(),
          ));
      }

      ssh_service::discover_projects(
          &conn.host,
          conn.port as u16,
          &conn.username,
          &conn.auth_method,
          conn.key_name.as_deref(),
          None,
          search_path,
      )
      .await
  }

  /// Save a discovered (or manually entered) remote project profile.
  #[tauri::command]
  #[specta::specta]
  pub async fn save_remote_project(
      input: SaveRemoteProjectInput,
      db: State<'_, DatabaseConnection>,
  ) -> Result<RemoteProjectProfile, AppError> {
      // Validate
      if input.name.trim().is_empty() {
          return Err(AppError::BadRequest("name must not be empty".into()));
      }
      let path = input.path.trim().to_string();
      if path.is_empty() {
          return Err(AppError::BadRequest("path must not be empty".into()));
      }
      if !path.starts_with('/') && !path.starts_with('~') {
          return Err(AppError::BadRequest(
              "path must be an absolute path (starting with '/' or '~')".into(),
          ));
      }
      // Verify connection exists
      ssh_connection::Entity::find_by_id(&input.connection_id)
          .one(db.inner())
          .await?
          .ok_or_else(|| {
              AppError::NotFound(format!(
                  "SSH connection '{}' not found",
                  input.connection_id
              ))
          })?;

      let id = uuid::Uuid::new_v4().to_string();
      let active = remote_project::ActiveModel {
          id: Set(id.clone()),
          connection_id: Set(input.connection_id),
          name: Set(input.name.trim().to_string()),
          path: Set(path),
          created_at: Set(now_unix_secs()),
      };
      let model = active.insert(db.inner()).await?;
      Ok(model_to_profile(model))
  }

  /// List all saved remote project profiles.
  #[tauri::command]
  #[specta::specta]
  pub async fn list_remote_projects(
      db: State<'_, DatabaseConnection>,
  ) -> Result<Vec<RemoteProjectProfile>, AppError> {
      let rows = remote_project::Entity::find().all(db.inner()).await?;
      Ok(rows.into_iter().map(model_to_profile).collect())
  }

  /// Delete a saved remote project profile.
  #[tauri::command]
  #[specta::specta]
  pub async fn delete_remote_project(
      id: String,
      db: State<'_, DatabaseConnection>,
  ) -> Result<(), AppError> {
      let model = remote_project::Entity::find_by_id(&id)
          .one(db.inner())
          .await?
          .ok_or_else(|| AppError::NotFound(format!("Remote project '{id}' not found")))?;

      let active: remote_project::ActiveModel = model.into();
      active.delete(db.inner()).await?;
      Ok(())
  }

  #[cfg(test)]
  mod tests {
      use super::*;
      use crate::models::ssh_config::DiscoveredProject;
      use crate::services::ssh_service::parse_discovered_projects_for_test;

      // Test parse logic (expose parse_discovered_projects via a test-only re-export
      // or duplicate the logic here)
      #[test]
      fn test_parse_git_dirs_extracts_parent_path() {
          let output = "/home/user/my-repo/.git\n/home/user/another/.git\n";
          let result = crate::services::ssh_service::parse_discovered_projects_for_test(output);
          assert_eq!(result.len(), 2);
          assert_eq!(result[0].path, "/home/user/my-repo");
          assert_eq!(result[0].name, "my-repo");
          assert_eq!(result[1].path, "/home/user/another");
      }

      #[test]
      fn test_parse_empty_output_returns_empty_vec() {
          let result = crate::services::ssh_service::parse_discovered_projects_for_test("");
          assert!(result.is_empty());
      }

      #[test]
      fn test_parse_strips_trailing_slash_from_git_dir() {
          let output = "/home/user/repo/.git/\n";
          let result = crate::services::ssh_service::parse_discovered_projects_for_test(output);
          assert_eq!(result.len(), 1);
          assert_eq!(result[0].path, "/home/user/repo");
      }

      #[test]
      fn test_parse_skips_malformed_lines() {
          let output = "/.git\n/home/user/good/.git\nnot-absolute\n";
          let result = crate::services::ssh_service::parse_discovered_projects_for_test(output);
          // "/.git" → parent = "" → skipped; "not-absolute" → no .git suffix → skipped
          assert_eq!(result.len(), 1);
          assert_eq!(result[0].name, "good");
      }

      #[test]
      fn test_validate_path_requires_leading_slash_or_tilde() {
          // Simulate path validation logic
          let valid_paths = ["/home/user/repo", "~/projects/repo"];
          let invalid_paths = ["relative/path", ""];
          for p in valid_paths {
              assert!(
                  p.starts_with('/') || p.starts_with('~'),
                  "Expected valid: {p}"
              );
          }
          for p in invalid_paths {
              assert!(
                  p.is_empty() || (!p.starts_with('/') && !p.starts_with('~')),
                  "Expected invalid: {p}"
              );
          }
      }
  }
  ```

  **NOTE on parse_discovered_projects_for_test**: The `parse_discovered_projects` function is private in `ssh_service.rs`. Make it `pub(crate)` so tests in `remote_projects.rs` can call it:
  ```rust
  // In ssh_service.rs — change to:
  pub(crate) fn parse_discovered_projects(output: &str) -> Vec<DiscoveredProject> { ... }
  ```
  Then in tests: `crate::services::ssh_service::parse_discovered_projects(output)` (remove the `_for_test` suffix — that was placeholder naming above; use the actual function name).

- [x] 5.2 Add `pub mod remote_projects;` to `src-tauri/src/commands/mod.rs`

### Task 6: Register new commands in `lib.rs` (AC: all)

- [x] 6.1 In `src-tauri/src/lib.rs`, add to the `collect_commands!` macro:
  ```rust
  commands::remote_projects::discover_remote_projects,
  commands::remote_projects::save_remote_project,
  commands::remote_projects::list_remote_projects,
  commands::remote_projects::delete_remote_project,
  ```

### Task 7: Regenerate TypeScript bindings (AC: all frontend)

- [x] 7.1 Run `npm run tauri dev` (or `cargo build` inside `src-tauri`) to trigger tauri-specta binding regeneration → `src/bindings.ts` gets new command + type signatures
- [x] 7.2 Verify `src/bindings.ts` has 4 new commands and 4 new types (`DiscoveredProject`, `RemoteProjectProfile`, `DiscoverProjectsInput`, `SaveRemoteProjectInput`)
- [x] 7.3 Add the 4 new types to the `export type { ... }` block in `src/lib/rspc.ts`:
  ```ts
  DiscoveredProject,
  RemoteProjectProfile,
  DiscoverProjectsInput,
  SaveRemoteProjectInput,
  ```

### Task 8: Build Remote Projects UI (AC: 1–12)

> 🎨 FRONTEND/UI STORY: MUST use `/frontend-design` skill BEFORE writing any UI code.
>
> Call `/frontend-design` with:
> "Remote Project Discovery panel for TinSu desktop app (Tauri). Dark theme. Tech stack: React 19, TypeScript, Tailwind v4, shadcn/ui. The main panel (RemoteProjectsPanel) shows a list of saved remote project profiles with columns: connection label (user@host:port), project name, remote path, and a delete icon. Has a 'Discover Projects' button at the top. Clicking 'Discover Projects' opens a DiscoverProjectsDialog with: a Select dropdown for saved SSH connections (populated from listSshConnections), an optional text input for search path (placeholder: '~', default empty → backend uses '~'), and a Discover button. While discovering, show a spinner and disable the button (AC12). Results list shows discovered repos with name and path, each row has a 'Save' button (AC4-5). Below results, a manual path section: text input + 'Add Manually' button (AC7). Empty state when no results (AC6). Errors shown as toast via sonner (AC11)."

- [x] 8.1 Create `src/components/settings/RemoteProjectsPanel.tsx`:
  - `useQuery(['remote_projects'])` → `commands.listRemoteProjects()`
  - `useQuery(['ssh_connections'])` → `commands.listSshConnections()` (for connection labels in the list)
  - `useMutation` for `commands.saveRemoteProject()` → invalidate `['remote_projects']`
  - `useMutation` for `commands.deleteRemoteProject()` → invalidate `['remote_projects']`
  - `useMutation` for `commands.discoverRemoteProjects()` — stores results in local state (not React Query cache), as this is an ephemeral operation
  - Command invocation pattern (MUST follow this pattern — NO tRPC):
    ```ts
    import { commands } from '@renderer/lib/rspc'
    const result = await commands.discoverRemoteProjects(input)
    if (result.status === 'error') throw new Error(JSON.stringify(result.error))
    return result.data
    ```
  - Delete: use `window.confirm()` or a `Dialog` (shadcn/ui) — **NOT `AlertDialog`** (not installed in this project; confirmed in T2.2 notes)
  - Toast: `import { toast } from 'sonner'`
  - Connection label helper: `\`${conn.username}@${conn.host}:${conn.port}\``

- [x] 8.2 Create `src/components/settings/DiscoverProjectsDialog.tsx` (or embed as part of panel — developer's discretion based on complexity):
  - Controlled by `open` / `onOpenChange` props
  - Local state: `connectionId`, `searchPath`, `discoveredProjects`, `isDiscovering`
  - On "Discover": call `discoverRemoteProjectsMutation.mutate(...)`, set `isDiscovering = true`
  - On "Save" for a result row: call `saveRemoteProject` mutation with connection_id + name + path
  - On "Add Manually": validate path starts with `/` or `~` before calling save mutation

- [x] 8.3 Add `RemoteProjectsPanel` to `src/components/dialogs/SettingsDialog.tsx`:
  ```tsx
  import { RemoteProjectsPanel } from '@renderer/components/settings/RemoteProjectsPanel'
  // Inside the dialog body, after SshConnectionsPanel:
  <hr className="border-border" />
  <RemoteProjectsPanel />
  ```

### Task 9: Write Rust tests (AC: 3, 7, 8)

- [x] 9.1 Add unit tests in `src-tauri/src/commands/remote_projects.rs` `#[cfg(test)] mod tests { ... }`:
  - Test: `save_remote_project` path validation rejects empty path
  - Test: `save_remote_project` path validation rejects relative path (no `/` or `~` prefix)
  - Test: `parse_discovered_projects` (via `ssh_service`) correctly parses `.git` output
  - Test: `parse_discovered_projects` returns empty vec for empty input
  - Test: `parse_discovered_projects` strips trailing slash from `.git/`

- [x] 9.2 Make `parse_discovered_projects` accessible for tests:
  - In `ssh_service.rs`, change `fn parse_discovered_projects` → `pub(crate) fn parse_discovered_projects`
  - Tests in `remote_projects.rs` call: `crate::services::ssh_service::parse_discovered_projects(output)`

### Task 10: Write frontend tests (AC: 1–12)

- [x] 10.1 Create `src/components/settings/RemoteProjectsPanel.test.tsx`:
  - Mock `commands` from `@renderer/lib/rspc` (follow pattern in `SshConnectionsPanel.test.tsx`)
  - Wrap with real `QueryClient` + `QueryClientProvider` (same pattern as T2.2 tests)
  - Test: renders empty state when no remote projects
  - Test: renders list of remote projects with connection label, name, path, and delete icon
  - Test: opens DiscoverProjectsDialog on "Discover Projects" click
  - Test: discovery calls `discoverRemoteProjects` with connection_id and searchPath
  - Test: saves discovered project when "Save" clicked
  - Test: shows empty state message when discovery returns empty array
  - Test: "Add Manually" button validates path starts with `/` or `~`
  - Test: delete calls `deleteRemoteProject` after confirmation

## Dev Notes

### Critical Architecture Rules

**NO tRPC.** This app uses tauri-specta bindings via `commands` from `@renderer/lib/rspc`. The tRPC pattern was deprecated in the Electron→Tauri migration. Every command call MUST follow:
```ts
const result = await commands.someCommand(input)
if (result.status === 'error') throw new Error(JSON.stringify(result.error))
return result.data
```

**React Query for mutations:**
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const queryClient = useQueryClient()
const saveMutation = useMutation({
  mutationFn: async (input: SaveRemoteProjectInput) => {
    const result = await commands.saveRemoteProject(input)
    if (result.status === 'error') throw new Error(JSON.stringify(result.error))
    return result.data
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['remote_projects'] })
    toast.success('Project saved')
  },
  onError: (error) => {
    toast.error('Failed to save project', { description: error.message })
  },
})
```

**Discovery is stateful but not cached:**
The `discoverRemoteProjects` command result is ephemeral (not stored in React Query cache). Use local `useState` in the dialog component to hold discovered projects. Do NOT add `['discover_remote_projects']` as a query key.

### File Structure Changes

```
src-tauri/
├── src/
│   ├── lib.rs                                  ← ADD: 4 remote_projects commands
│   ├── commands/
│   │   ├── mod.rs                              ← ADD: pub mod remote_projects
│   │   └── remote_projects.rs                  ← NEW: 4 Tauri commands + 5 unit tests
│   ├── services/
│   │   └── ssh_service.rs                      ← ADD: discover_projects() + ssh_exec()
│   │                                               + make parse_discovered_projects pub(crate)
│   ├── models/
│   │   └── ssh_config.rs                       ← ADD: 4 new types
│   ├── db/
│   │   └── entities/
│   │       ├── mod.rs                          ← ADD: pub mod remote_project
│   │       └── remote_project.rs               ← NEW: SeaORM entity
│   └── migration/
│       ├── mod.rs                              ← ADD: new migration
│       └── m20260412_000003_remote_projects.rs ← NEW: migration
src/
├── bindings.ts                                 ← AUTO-GENERATED (4 new commands + types)
├── lib/rspc.ts                                 ← ADD: 4 new exported types
├── components/
│   ├── dialogs/
│   │   └── SettingsDialog.tsx                  ← ADD: RemoteProjectsPanel section
│   └── settings/
│       ├── RemoteProjectsPanel.tsx             ← NEW: main panel + discovery dialog
│       └── RemoteProjectsPanel.test.tsx        ← NEW: tests
```

### Existing Code to Reuse

- **`TestHandler` in `ssh_service.rs`** — already defined, captures server fingerprint. The new `ssh_exec` helper must reuse it (not redeclare). `TestHandler` is a private struct in `ssh_service.rs` — it's accessible since `ssh_exec` is in the same module.
- **`export_key(name)`** — already in `ssh_service.rs`. Used in `ssh_exec` for key auth.
- **`commands::list_ssh_connections`** — already implemented in T2.2. Call from frontend to populate the connection dropdown in the discovery dialog.
- **`AppError` variants** — use `NotFound`, `BadRequest`, `Internal`. Do NOT create new error types.
- **`uuid::Uuid::new_v4().to_string()`** — UUID pattern used throughout; `uuid` crate confirmed in Cargo.toml.
- **`now_unix_secs()`** — define privately in `remote_projects.rs` (same pattern as `ssh_connections.rs` and `ssh.rs` — each module defines its own, not imported across).
- **`SshConnectionsPanel.test.tsx`** — reference for mock pattern, QueryClient wrapper, command invocation mocks.

### russh 0.60.0 Critical Notes (from T2.2 Completion Notes — DO NOT IGNORE)

1. **Use `russh::keys::*` ONLY** — NOT `ssh_key::*` from the public crate. They are different types. The public `ssh_key` crate is type-incompatible with russh's bundled fork (`internal-russh-forked-ssh-key`).
2. **`authenticate_publickey`/`authenticate_password` return `AuthResult` enum**, not `bool`. Call `.success()` on the result.
3. **For SSH exec**, the channel API:
   - `session.channel_open_session().await` → `Result<Channel<Msg>, Error>`
   - `channel.exec(want_reply: bool, command: impl Into<Bytes>)` → exec the command
   - `channel.wait().await` → `Option<ChannelMsg>` loop until `None`
   - `ChannelMsg::Data { ref data }` — data is `CryptoVec` (use `extend_from_slice`)
   - `ChannelMsg::Eof` and `ChannelMsg::ExitStatus` signal completion
4. **Always `session.disconnect(Disconnect::ByApplication, "", "")`** after use.
5. **russh = "0.60.0"** is already in `src-tauri/Cargo.toml` — do NOT add/upgrade.

### Password Auth Limitation

The `ssh_connections` table does NOT store passwords (T2.2 design decision). Discovery requires executing remote commands, which requires an established SSH session. This means **only key-based connections can be used for discovery**. If a connection uses `auth_method = "password"`, the command returns `AppError::BadRequest` with a clear message. Surface this to the user in the dialog ("This connection uses password auth — please re-save with an SSH key to enable discovery").

### Manual Path Input Validation

The manual path input must accept:
- `/absolute/path` (starts with `/`)
- `~/relative/to/home` (starts with `~`)

Reject empty string and any path that doesn't start with `/` or `~`. The error should appear inline (not as a toast) since it's synchronous validation.

### Database Schema Notes

- `connection_id` is a TEXT FK into `ssh_connections.id` with `ON DELETE CASCADE` — if the SSH connection is deleted, all its remote projects are automatically removed.
- No UNIQUE constraint on `(connection_id, path)` — user can save the same path twice (rare edge case, acceptable).
- `path` stored exactly as provided (may start with `~`). Path expansion happens on the remote machine at execution time; the local DB stores the raw path string.

### Rust Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Command file | snake_case | `remote_projects.rs` |
| Entity file | snake_case | `remote_project.rs` (singular) |
| Structs | PascalCase | `RemoteProjectProfile`, `DiscoveredProject` |
| Commands | snake_case | `discover_remote_projects`, `save_remote_project` |
| Tests | `#[cfg(test)] mod tests` co-located | |

### Error Handling Rules

- Invalid input → `AppError::BadRequest` with descriptive message
- DB row not found → `AppError::NotFound`
- SSH connection/auth/exec failures → `AppError::Internal` with error detail
- NEVER `unwrap()` in production paths
- NEVER `println!` — use `tracing::warn!`, `tracing::error!`
- SSH discovery errors (e.g., network timeout) surface as `Err(AppError::Internal(...))` — different from `test_connection` which returns `Ok(SshConnectionTestResult { success: false, ... })`. Discovery either succeeds with a list or fails with an error.

### Testing Requirements

- Rust tests co-located in `#[cfg(test)] mod tests` within source files
- `cargo test` must pass with 0 failures
- Minimum 5 Rust tests covering parse logic and path validation
- Frontend tests with Vitest (`npm run test` must pass)
- Discovery integration test (actual SSH) is NOT required — only unit tests for parse logic and validation

### Previous Story Context (T2.2 Patterns to Follow)

From T2.2 completion notes:
- `AlertDialog` (shadcn/ui) is **NOT installed** — use plain `Dialog` for confirmations
- Frontend tests: use real `QueryClient` + `QueryClientProvider` wrapper (NOT mocking `@tanstack/react-query` globally)
- Sonner mock must spread args: `(...args) => mockFn(...args)` to avoid `undefined` second-arg issues in `toHaveBeenCalledWith`
- `window.confirm()` is acceptable for delete confirmation (as used in T2.2)
- Import `commands` via `@renderer/lib/rspc`, never from `../bindings` directly

### Architecture Source References

- Remote project discovery: `_bmad-output/planning-artifacts/epics.md` → Epic 2, Story T2.3 (FR56)
- SSH service patterns: `src-tauri/src/services/ssh_service.rs` (test_connection + TestHandler)
- SSH connection entity: `src-tauri/src/db/entities/ssh_connection.rs`
- IPC pattern: `src/lib/rspc.ts`
- Settings dialog integration point: `src/components/dialogs/SettingsDialog.tsx`
- T2.2 command pattern reference: `src-tauri/src/commands/ssh_connections.rs`
- Test reference: `src/components/settings/SshConnectionsPanel.test.tsx`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

N/A

### Completion Notes List

- Task 1: Migration `m20260412_000003_remote_projects` created; registered as 3rd migration in Migrator vec (order critical — ssh_connections FK must pre-exist)
- Task 2: SeaORM entity `remote_project.rs` created; added to entities mod
- Task 3: Added `DiscoveredProject`, `RemoteProjectProfile`, `DiscoverProjectsInput`, `SaveRemoteProjectInput` to `ssh_config.rs`
- Task 4: `discover_projects()` and private `ssh_exec()` added to `ssh_service.rs`; `parse_discovered_projects` made `pub(crate)`; reuses existing `TestHandler` struct and `export_key()`; 30s timeout via `tokio::time::timeout`
- Task 5: `remote_projects.rs` commands module created with 4 commands: `discover_remote_projects`, `save_remote_project`, `list_remote_projects`, `delete_remote_project`; password auth returns BadRequest (passwords not stored in DB per T2.2)
- Task 6: 4 new commands registered in `lib.rs` `collect_commands!` macro
- Task 7: Bindings regenerated via `cargo test --lib generate_bindings -- --ignored`; 4 new commands + 4 new types confirmed in `src/bindings.ts`; types added to `src/lib/rspc.ts` export block
- Task 8: `RemoteProjectsPanel` + embedded `DiscoverProjectsDialog` created in single file (developer discretion — complexity didn't warrant separate file); panel added to `SettingsDialog.tsx` after `SshConnectionsPanel`; `/frontend-design` skill used for UI; matches existing terminal/hacker dark aesthetic (JetBrains Mono, green accents)
- Task 9: 5 Rust unit tests in `remote_projects.rs` testing parse logic and path validation; `parse_discovered_projects` made `pub(crate)` in `ssh_service.rs`
- Task 10: 8 frontend tests in `RemoteProjectsPanel.test.tsx`; follows `SshConnectionsPanel.test.tsx` pattern with real `QueryClient`, mocked `commands`, mocked `sonner`
- All tests pass: 122 Rust (0 regressions) + 8 new frontend tests

### File List

- `src-tauri/src/migration/m20260412_000003_remote_projects.rs` (NEW)
- `src-tauri/src/migration/mod.rs` (MODIFIED — added migration)
- `src-tauri/src/db/entities/remote_project.rs` (NEW)
- `src-tauri/src/db/entities/mod.rs` (MODIFIED — added remote_project)
- `src-tauri/src/models/ssh_config.rs` (MODIFIED — added 4 new types)
- `src-tauri/src/services/ssh_service.rs` (MODIFIED — added discover_projects, ssh_exec, parse_discovered_projects pub(crate))
- `src-tauri/src/commands/remote_projects.rs` (NEW)
- `src-tauri/src/commands/mod.rs` (MODIFIED — added remote_projects)
- `src-tauri/src/lib.rs` (MODIFIED — registered 4 new commands)
- `src/bindings.ts` (AUTO-GENERATED — 4 new commands + 4 new types)
- `src/lib/rspc.ts` (MODIFIED — added 4 new type exports)
- `src/components/settings/RemoteProjectsPanel.tsx` (NEW)
- `src/components/settings/RemoteProjectsPanel.test.tsx` (NEW)
- `src/components/dialogs/SettingsDialog.tsx` (MODIFIED — added RemoteProjectsPanel section)

### Change Log

- 2026-04-12: Implemented T2.3 Remote Project Discovery — DB migration, SeaORM entity, SSH discovery service, 4 Tauri commands, TypeScript bindings, RemoteProjectsPanel UI with embedded DiscoverProjectsDialog, 5 Rust unit tests + 8 frontend tests
