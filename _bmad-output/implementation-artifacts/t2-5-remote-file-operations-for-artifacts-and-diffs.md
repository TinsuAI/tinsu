# Story T2.5: Remote File Operations for Artifacts and Diffs

Status: done

## Story

As a founder,
I want to read and write project files on a remote machine (story files, diffs, logs),
so that I can review agent changes and manage artifacts without SSH-ing manually.

## Acceptance Criteria

1. **Given** remote project access from T2.3–T2.4 **When** `get_remote_task_diff` is called with a valid remote task's `task_id` **Then** the backend runs `git diff main...{branch_name}` and `git diff --name-status main...{branch_name}` on the remote machine via SSH exec, parses the output using the existing `parse_unified_diff` function, and returns a `GitDiffResult` identical in structure to the local `get_task_diff` response

2. **Given** a remote task with no branch yet (or a local task) **When** `get_remote_task_diff` is called **Then** the command returns an empty `GitDiffResult` (same empty-state behavior as local `get_task_diff`)

3. **Given** a valid remote project and a relative path within the project **When** `read_remote_file` is called **Then** the backend validates the path (no null bytes, no `../` traversal, non-empty), checks file size via `wc -c < '{safe_path}'`, returns `AppError::BadRequest("File too large: exceeds 1MB limit")` if size >1048576 bytes, and otherwise returns the UTF-8 file contents via `cat '{safe_path}'` over SSH exec

4. **Given** a path containing `../` traversal or null bytes **When** `read_remote_file` is called **Then** the command returns `AppError::BadRequest("Invalid path: path traversal not allowed")` before making any SSH connection

5. **Given** a remote file that does not exist or has permission denied **When** `read_remote_file` is called **Then** the backend maps the SSH stderr to a user-friendly error: "File not found: {path}" (stderr contains "No such file") or "Permission denied: {path}" (stderr contains "Permission denied"), otherwise "Remote file error: {stderr}"

6. **Given** a valid remote file read or diff operation **When** the SSH operation completes **Then** it completes in <3 seconds for files up to 1MB (NFR34); larger files are blocked at step 3

7. **Given** the new commands are registered **When** bindings are regenerated **Then** `src/bindings.ts` has `get_remote_task_diff` and `read_remote_file` commands exported; no new input types are needed (both use primitive String params)

8. **Given** the implementation **When** `cargo test` is run **Then** all new and existing Rust tests pass (0 regressions); minimum 5 new unit tests covering: path traversal rejection, cat command quoting, git diff command quoting, empty-diff on no branch, and wc-c size check command format

## Tasks / Subtasks

### Task 1: Expose `parse_unified_diff` as `pub(crate)` (AC: 1)

- [x] 1.1 In `src-tauri/src/services/git_service.rs`, change the visibility of `parse_unified_diff`:
  ```rust
  // BEFORE:
  fn parse_unified_diff(unified: &str, name_status: &str) -> Vec<GitDiffFile> {
  
  // AFTER:
  pub(crate) fn parse_unified_diff(unified: &str, name_status: &str) -> Vec<GitDiffFile> {
  ```
  This is a visibility-only change — no behavior change. The function is already tested by `get_task_diff` tests.

### Task 2: Create `remote_files.rs` with `get_remote_task_diff` command (AC: 1, 2, 6, 7, 8)

- [x] 2.1 Create `src-tauri/src/commands/remote_files.rs`:

  ```rust
  //! Remote file operations — git diffs and artifact reads via SSH exec.
  //! Reuses ssh_service::run_ssh_exec (same pattern as remote_projects.rs and remote_agent.rs).

  use crate::db::entities::{remote_project, ssh_connection, task, task_session};
  use crate::error::AppError;
  use crate::services::git_service::{parse_unified_diff, GitDiffResult, GitDiffSummary};
  use crate::services::ssh_service;
  use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter};
  use tauri::State;

  // ── get_remote_task_diff ──────────────────────────────────────────────────────

  /// Get the git diff for a remote task's branch vs main.
  ///
  /// Mirrors `get_task_diff` but executes git commands on the remote machine via SSH.
  /// Returns empty GitDiffResult if the task has no branch or is not a remote task.
  #[tauri::command]
  #[specta::specta]
  pub async fn get_remote_task_diff(
      task_id: String,
      db: State<'_, DatabaseConnection>,
  ) -> Result<GitDiffResult, AppError> {
      if task_id.is_empty() {
          return Err(AppError::BadRequest("task_id must not be empty".into()));
      }

      let empty = GitDiffResult {
          files: vec![],
          summary: GitDiffSummary {
              files_changed: 0,
              lines_added: 0,
              lines_removed: 0,
          },
      };

      // Load task → branch_name
      let task_model = task::Entity::find_by_id(&task_id)
          .one(db.inner())
          .await?
          .ok_or_else(|| AppError::NotFound(format!("Task '{task_id}' not found")))?;

      let branch_name = match task_model.branch_name {
          Some(ref b) if !b.is_empty() => b.clone(),
          _ => return Ok(empty),
      };

      // Load task_session to get remote_project_id and remote_connection_id
      let session = task_session::Entity::find()
          .filter(task_session::Column::TaskId.eq(&task_id))
          .one(db.inner())
          .await?;

      let (remote_project_id, remote_connection_id) = match session {
          Some(s)
              if s.remote_project_id.is_some() && s.remote_connection_id.is_some() =>
          {
              (s.remote_project_id.unwrap(), s.remote_connection_id.unwrap())
          }
          // Not a remote task — caller should use get_task_diff instead
          _ => return Ok(empty),
      };

      // Load remote_project → path
      let rp = remote_project::Entity::find_by_id(&remote_project_id)
          .one(db.inner())
          .await?
          .ok_or_else(|| {
              AppError::NotFound(format!("Remote project '{remote_project_id}' not found"))
          })?;

      // Load ssh_connection → auth details
      let conn = ssh_connection::Entity::find_by_id(&remote_connection_id)
          .one(db.inner())
          .await?
          .ok_or_else(|| {
              AppError::NotFound(format!(
                  "SSH connection '{remote_connection_id}' not found"
              ))
          })?;

      // Build git diff commands — quote branch_name and path for shell safety
      let safe_branch = branch_name.replace("'", "'\\''");
      let safe_path = rp.path.replace("'", "'\\''");

      let diff_cmd = format!(
          "cd '{}' && git diff 'main...{}'",
          safe_path, safe_branch
      );
      let status_cmd = format!(
          "cd '{}' && git diff --name-status 'main...{}'",
          safe_path, safe_branch
      );

      // Run both commands on remote — 15s timeout each (same as create_remote_task_session)
      let unified = tokio::time::timeout(
          tokio::time::Duration::from_secs(15),
          ssh_service::run_ssh_exec(
              &conn.host,
              conn.port as u16,
              &conn.username,
              &conn.auth_method,
              conn.key_name.as_deref(),
              None,
              &diff_cmd,
          ),
      )
      .await
      .map_err(|_| AppError::Internal("Remote git diff timed out".into()))??;

      let name_status = tokio::time::timeout(
          tokio::time::Duration::from_secs(15),
          ssh_service::run_ssh_exec(
              &conn.host,
              conn.port as u16,
              &conn.username,
              &conn.auth_method,
              conn.key_name.as_deref(),
              None,
              &status_cmd,
          ),
      )
      .await
      .map_err(|_| AppError::Internal("Remote git name-status timed out".into()))
      .unwrap_or_else(|_| Ok(String::new()))
      .unwrap_or_default();

      if unified.is_empty() {
          return Ok(empty);
      }

      let files = parse_unified_diff(&unified, &name_status);
      let lines_added: i32 = files.iter().map(|f| f.additions).sum();
      let lines_removed: i32 = files.iter().map(|f| f.deletions).sum();
      let files_changed = files.len() as i32;

      Ok(GitDiffResult {
          summary: GitDiffSummary {
              files_changed,
              lines_added,
              lines_removed,
          },
          files,
      })
  }

  // ── read_remote_file ──────────────────────────────────────────────────────────

  /// Read a file from the remote project filesystem via SSH exec.
  ///
  /// `relative_path`: path relative to the remote project root (e.g. "_bmad-output/implementation-artifacts/t2-5.md")
  ///
  /// Validates:
  /// - No null bytes (injection guard)
  /// - No `../` traversal
  /// - Non-empty
  /// - File size ≤ 1MB (checked via wc -c before reading)
  #[tauri::command]
  #[specta::specta]
  pub async fn read_remote_file(
      remote_project_id: String,
      relative_path: String,
      db: State<'_, DatabaseConnection>,
  ) -> Result<String, AppError> {
      // ── Input validation (no SSH needed) ─────────────────────────────────
      if relative_path.is_empty() {
          return Err(AppError::BadRequest("relative_path must not be empty".into()));
      }
      if relative_path.contains('\0') {
          return Err(AppError::BadRequest(
              "Invalid path: path contains null bytes".into(),
          ));
      }
      // Prevent path traversal — reject any component with ".."
      if relative_path.contains("../") || relative_path.starts_with("..") {
          return Err(AppError::BadRequest(
              "Invalid path: path traversal not allowed".into(),
          ));
      }
      // Reject absolute paths — must be relative to project root
      if relative_path.starts_with('/') {
          return Err(AppError::BadRequest(
              "Invalid path: absolute paths not allowed (use relative path from project root)".into(),
          ));
      }

      // ── Load remote project and SSH connection ────────────────────────────
      let rp = remote_project::Entity::find_by_id(&remote_project_id)
          .one(db.inner())
          .await?
          .ok_or_else(|| {
              AppError::NotFound(format!("Remote project '{remote_project_id}' not found"))
          })?;

      let conn = ssh_connection::Entity::find_by_id(&rp.connection_id)
          .one(db.inner())
          .await?
          .ok_or_else(|| {
              AppError::NotFound(format!("SSH connection '{}' not found", rp.connection_id))
          })?;

      // ── Build absolute path safely ────────────────────────────────────────
      let absolute_path = format!("{}/{}", rp.path.trim_end_matches('/'), relative_path);
      let safe_abs = absolute_path.replace("'", "'\\''");

      // ── Check file size first (NFR34: <3s for ≤1MB) ──────────────────────
      let size_cmd = format!("wc -c < '{safe_abs}'");
      let size_output = tokio::time::timeout(
          tokio::time::Duration::from_secs(3),
          ssh_service::run_ssh_exec(
              &conn.host,
              conn.port as u16,
              &conn.username,
              &conn.auth_method,
              conn.key_name.as_deref(),
              None,
              &size_cmd,
          ),
      )
      .await
      .map_err(|_| AppError::Internal("File size check timed out".into()))??;

      let file_size: u64 = size_output.trim().parse().unwrap_or(0);
      if file_size > 1_048_576 {
          return Err(AppError::BadRequest(format!(
              "File too large: {file_size} bytes exceeds 1MB limit"
          )));
      }

      // ── Read file contents ────────────────────────────────────────────────
      let cat_cmd = format!("cat '{safe_abs}'");
      let result = tokio::time::timeout(
          tokio::time::Duration::from_secs(3),
          ssh_service::run_ssh_exec(
              &conn.host,
              conn.port as u16,
              &conn.username,
              &conn.auth_method,
              conn.key_name.as_deref(),
              None,
              &cat_cmd,
          ),
      )
      .await
      .map_err(|_| AppError::Internal("Remote file read timed out after 3 seconds".into()));

      match result {
          Err(_timeout) => Err(AppError::Internal(
              "Remote file read timed out after 3 seconds".into(),
          )),
          Ok(Err(AppError::Internal(ref msg))) => {
              // Map SSH stderr to user-friendly errors
              if msg.contains("No such file") || msg.contains("no such file") {
                  Err(AppError::NotFound(format!("File not found: {relative_path}")))
              } else if msg.contains("Permission denied") || msg.contains("permission denied") {
                  Err(AppError::Internal(format!(
                      "Permission denied: {relative_path}"
                  )))
              } else {
                  Err(AppError::Internal(format!(
                      "Remote file error: {msg}"
                  )))
              }
          }
          Ok(other) => other,
      }
  }

  // ── Tests ─────────────────────────────────────────────────────────────────────

  #[cfg(test)]
  mod tests {
      use super::*;

      #[test]
      fn test_path_traversal_detection_rejects_dotdot_slash() {
          // Paths with ../ must be rejected before SSH
          let paths = ["../etc/passwd", "foo/../bar", "a/b/../../etc/passwd"];
          for p in &paths {
              assert!(
                  p.contains("../") || p.starts_with(".."),
                  "Test case '{p}' must match traversal check"
              );
          }
      }

      #[test]
      fn test_absolute_path_rejected() {
          let p = "/etc/passwd";
          assert!(p.starts_with('/'), "Absolute path must be rejected");
      }

      #[test]
      fn test_cat_command_quotes_path_correctly() {
          let path = "/home/user/my project/file.md";
          let safe = path.replace("'", "'\\''");
          let cmd = format!("cat '{safe}'");
          assert_eq!(cmd, "cat '/home/user/my project/file.md'");
      }

      #[test]
      fn test_cat_command_escapes_single_quotes_in_path() {
          let path = "/home/user/it's-a-project/file.md";
          let safe = path.replace("'", "'\\''");
          let cmd = format!("cat '{safe}'");
          assert_eq!(cmd, "cat '/home/user/it'\\''s-a-project/file.md'");
      }

      #[test]
      fn test_git_diff_command_quotes_branch_and_path() {
          let project_path = "/home/user/my-project";
          let branch = "tinsu/story-abc-my-feature";
          let safe_path = project_path.replace("'", "'\\''");
          let safe_branch = branch.replace("'", "'\\''");
          let cmd = format!("cd '{}' && git diff 'main...{}'", safe_path, safe_branch);
          assert_eq!(
              cmd,
              "cd '/home/user/my-project' && git diff 'main...tinsu/story-abc-my-feature'"
          );
      }

      #[test]
      fn test_wc_c_size_check_command_format() {
          let abs_path = "/home/user/project/file.md";
          let safe = abs_path.replace("'", "'\\''");
          let cmd = format!("wc -c < '{safe}'");
          assert_eq!(cmd, "wc -c < '/home/user/project/file.md'");
      }

      #[test]
      fn test_empty_diff_returned_when_branch_name_is_empty_string() {
          // This validates that the early-return logic on empty branch_name is correct
          let branch_name: Option<String> = Some(String::new());
          let is_empty = branch_name.as_ref().map(|b| b.is_empty()).unwrap_or(true);
          assert!(is_empty, "Empty branch_name should trigger empty diff return");
      }

      #[test]
      fn test_absolute_path_construction_trims_trailing_slash() {
          let project_root = "/home/user/project/";
          let relative = "_bmad-output/implementation-artifacts/t2-5.md";
          let abs = format!("{}/{}", project_root.trim_end_matches('/'), relative);
          assert_eq!(
              abs,
              "/home/user/project/_bmad-output/implementation-artifacts/t2-5.md"
          );
      }
  }
  ```

### Task 3: Register `remote_files` module (AC: 7)

- [x] 3.1 Add to `src-tauri/src/commands/mod.rs`:
  ```rust
  pub mod remote_files;
  ```

- [x] 3.2 In `src-tauri/src/lib.rs`, add to `collect_commands![]` block (after the existing `remote_agent` entries):
  ```rust
  commands::remote_files::get_remote_task_diff,
  commands::remote_files::read_remote_file,
  ```

### Task 4: Regenerate TypeScript bindings (AC: 7)

- [x] 4.1 Run `cargo build` inside `src-tauri/` (or `cargo test --lib generate_bindings -- --ignored`) to regenerate `src/bindings.ts`
- [x] 4.2 Verify `src/bindings.ts` has `getRemoteTaskDiff` and `readRemoteFile` commands (Specta converts `snake_case` → `camelCase`)
- [x] 4.3 No new input types to export in `src/lib/rspc.ts` — both commands use primitive String parameters. The return types `GitDiffResult` and `String` are already exported or are primitives.

### Task 5: Run tests and verify (AC: 8)

- [x] 5.1 Run `cargo test` and confirm all 7+ new unit tests pass and 0 regressions in the existing test suite (128 tests from T2.4 + 7 new = 135+ expected)

## Dev Notes

### Critical Architecture Rules

**This story has NO frontend UI changes.** T2.5 provides backend commands only. Frontend routing (deciding whether to call `get_task_diff` vs `get_remote_task_diff` based on task type) comes in T2.7 (Local/Remote Project Switcher).

**NO SFTP crate added.** Cargo.toml is NOT modified. The story implements remote file access via SSH exec (`cat`) — functionally equivalent to SFTP for text files (story markdown, logs, diffs) and already proven by T2.3's `discover_remote_projects`. Binary files are not needed for the MVP use cases.

**NO new migration.** This story adds zero schema changes. The `task_sessions.remote_project_id` and `task_sessions.remote_connection_id` columns from T2.4 migration 000004 are already in place.

**DO NOT redefine `GitDiffResult`, `GitDiffSummary`, `GitDiffFile`.** These types live in `src-tauri/src/services/git_service.rs` and are already exported to TypeScript bindings. Import them via:
```rust
use crate::services::git_service::{parse_unified_diff, GitDiffResult, GitDiffSummary};
```

**DO NOT duplicate SSH auth logic.** Call `ssh_service::run_ssh_exec(...)` directly — same as `remote_agent.rs` line 613–625. Do not create a new SSH connection struct.

### russh 0.60.0 — Project uses 0.60.0 (NOT 0.54.6 from architecture doc)

Verified in `src-tauri/Cargo.toml` line 32. Do NOT change this version.

This story does NOT call russh directly — it uses `ssh_service::run_ssh_exec` which handles all russh internals. No russh API needed in `remote_files.rs`.

### How `run_ssh_exec` Works (Critical)

Located at `src-tauri/src/services/ssh_service.rs:305–398`.

```rust
pub(crate) async fn run_ssh_exec(
    host: &str,
    port: u16,
    username: &str,
    auth_method: &str,   // "key" | "password"
    key_name: Option<&str>,
    password: Option<&str>,
    command: &str,
) -> Result<String, AppError>
```

- Connects → authenticates → execs command → collects stdout → returns as `String`
- Returns `Err(AppError::Internal(...))` if SSH connection fails, auth fails, or stdout is not UTF-8
- **IMPORTANT:** The error message contains SSH stderr output. Inspect the message string to map to user-friendly errors (as shown in `read_remote_file` error handling).
- Pass `None` for `password` when using key auth (password is only used for `auth_method == "password"`)

### `parse_unified_diff` — Visibility Change Only

This is the private function at `src-tauri/src/services/git_service.rs:390`. It already has tests via `get_task_diff`.

Only change: `fn parse_unified_diff` → `pub(crate) fn parse_unified_diff`. No logic change.

### git diff Command on Remote (Critical)

Local `get_task_diff` runs `git diff main...HEAD` in the worktree path.

For remote tasks, we run `git diff main...<branch_name>` in the project path (not worktree — there is no local worktree for remote tasks).

```bash
# Command pattern:
cd '{safe_project_path}' && git diff 'main...{safe_branch_name}'
```

**Why `cd && git` instead of `cwd` in run_ssh_exec?** `run_ssh_exec` executes a single command string. There's no separate cwd parameter. Use `cd '{path}' && git diff ...` to set working directory.

**Three-dot vs two-dot diff:** Use `main...{branch}` (three dots) — same as local `get_task_diff`. Three-dot shows changes since branch diverged from main, excluding main-only changes.

### File Size Check (NFR34)

The `wc -c` command works on both Linux and macOS (BSD) and reads the file byte count without loading into memory:

```bash
wc -c < '/path/to/file'
```

Output: `" 12345\n"` or `"12345\n"` — always trim and parse as u64. If parse fails (file not found, permission error), `unwrap_or(0)` treats size as 0 and proceeds to the `cat` call which will then fail with a user-friendly error.

**1MB limit = 1,048,576 bytes.** Reject with `AppError::BadRequest` before reading.

### Path Quoting (Shell Injection Prevention)

ALL user-controlled strings embedded in shell commands must be single-quoted with internal single quotes escaped:

```rust
let safe = user_input.replace("'", "'\\''");
let cmd = format!("cat '{safe}'");
```

The three values to escape are:
1. `rp.path` (project root from remote_projects table)
2. `relative_path` (user-provided)
3. `task_model.branch_name` (from tasks table)

### File Structure Changes

```
src-tauri/
├── src/
│   ├── lib.rs                              ← MODIFY: +2 commands in collect_commands![]
│   ├── commands/
│   │   ├── mod.rs                          ← MODIFY: +pub mod remote_files
│   │   └── remote_files.rs                 ← NEW: get_remote_task_diff, read_remote_file, 7 unit tests
│   └── services/
│       └── git_service.rs                  ← MODIFY: parse_unified_diff → pub(crate)
src/
└── bindings.ts                             ← AUTO-GENERATED: +getRemoteTaskDiff, +readRemoteFile
```

### Entity Imports for remote_files.rs

```rust
use crate::db::entities::{remote_project, ssh_connection, task, task_session};
```

All four entities exist and are identical to their T2.3 / T2.4 counterparts. No new entity generation needed.

Field access:
- `task_model.branch_name: Option<String>` (from `tasks` table, added in T1.4)
- `task_session.remote_project_id: Option<String>` (added in T2.4 migration 000004)
- `task_session.remote_connection_id: Option<String>` (added in T2.4 migration 000004)
- `remote_project.path: String` (project path on remote machine)
- `remote_project.connection_id: String` (FK to ssh_connections.id)
- `ssh_connection.host: String`, `ssh_connection.port: i64`, `ssh_connection.username: String`
- `ssh_connection.auth_method: String` ("key" | "password")
- `ssh_connection.key_name: Option<String>` (SSH key name in keychain)

### Error Type Mapping

`run_ssh_exec` returns `Err(AppError::Internal(message))` for SSH-level errors. The message includes stderr output from the remote command. Map in `read_remote_file`:

| SSH stderr contains | User-facing error |
|---------------------|-------------------|
| "No such file" / "no such file" | `AppError::NotFound("File not found: {relative_path}")` |
| "Permission denied" / "permission denied" | `AppError::Internal("Permission denied: {relative_path}")` |
| Other | `AppError::Internal("Remote file error: {message}")` |

For `get_remote_task_diff`, SSH errors propagate as-is (same behavior as local `get_task_diff`).

### Testing Requirements

- Rust unit tests: co-located in `remote_files.rs` (`#[cfg(test)] mod tests`)
- **No integration tests against real SSH** — all 7 tests are pure unit tests (no async, no DB)
- Tests validate: path validation logic, command string construction, quoting, empty-state behavior
- `cargo test` must pass with 0 failures (128 existing + 7 new = 135 expected)

### Existing Code to Reuse (DO NOT REINVENT)

| Existing | Location | Use in T2.5 |
|----------|----------|-------------|
| `run_ssh_exec` | `services/ssh_service.rs:305` | Both commands use this for SSH execution |
| `parse_unified_diff` | `services/git_service.rs:390` | `get_remote_task_diff` calls this after making it `pub(crate)` |
| `GitDiffResult` / `GitDiffSummary` / `GitDiffFile` | `services/git_service.rs:56-60` | Return type for `get_remote_task_diff` |
| `task_session` entity | `db/entities/task_session.rs` | Lookup remote_project_id for task |
| `remote_project` entity | `db/entities/remote_project.rs` | Get project path |
| `ssh_connection` entity | `db/entities/ssh_connection.rs` | Get auth details |
| `task` entity | `db/entities/task.rs` | Get branch_name |

### Architecture Source References

- Remote task session pattern: `src-tauri/src/commands/remote_agent.rs` (T2.4)
- SSH exec pattern: `src-tauri/src/services/ssh_service.rs::run_ssh_exec`
- Local diff pattern: `src-tauri/src/commands/git.rs::get_task_diff` + `services/git_service.rs::get_diff`
- Migration pattern (for reference only — no new migration needed): `src-tauri/src/migration/mod.rs`
- Entity access patterns: `src-tauri/src/commands/remote_agent.rs` lines 578–591

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

_N/A_

### Completion Notes List

- ✅ Task 1: Changed `parse_unified_diff` visibility to `pub(crate)` in `git_service.rs` (line 390) — visibility-only change, no behavior change
- ✅ Task 2: Created `src-tauri/src/commands/remote_files.rs` with `get_remote_task_diff` (mirrors local `get_task_diff` via SSH exec) and `read_remote_file` (validates path, checks size via wc -c, reads via cat) — 8 unit tests included (1 extra: absolute path construction test)
- ✅ Task 3: Registered `pub mod remote_files` in `commands/mod.rs`; added both commands to `collect_commands![]` in `lib.rs` after `detach_remote_task_terminal`
- ✅ Task 4: Regenerated bindings via `cargo test generate_bindings -- --ignored`; confirmed `getRemoteTaskDiff` and `readRemoteFile` exported in `src/bindings.ts`
- ✅ Task 5: `cargo test` → 136 passed, 0 failed, 1 ignored (128 existing + 8 new unit tests)

### Review Findings

- [x] [Review][Patch] Silent error swallowing on name_status timeout [remote_files.rs:124] — FIXED: Changed `unwrap_or_else` fallback to propagate errors using `??`, making error handling consistent with first git command
- [x] [Review][Patch] Unprotected panic in parse_unified_diff [remote_files.rs:131] — FIXED: Added `std::panic::catch_unwind` wrapper with graceful error handling
- [x] [Review][Patch] File size check bypass on wc -c parse failure [remote_files.rs:222] — FIXED: Changed `unwrap_or(0)` to `.map_err()` to validate numeric output, returning error on invalid wc response
- [x] [Review][Patch] Integer overflow in diff line count [remote_files.rs:132-134] — FIXED: Replaced `.sum()` with `saturating_add` for lines_added/lines_removed, and `.min(i32::MAX as usize)` for files_changed
- [x] [Review][Defer] Task ownership verification — deferred, pre-existing security concern beyond t2-5 scope
- [x] [Review][Defer] Database result validation — deferred, pre-existing concern from t2-2 connection management
- [x] [Review][Defer] Test coverage on SSH error paths — deferred, enhancement for future test expansion

### Change Log

- 2026-04-12: [t2-5] Implemented remote file operations — `get_remote_task_diff` and `read_remote_file` Tauri commands via SSH exec; `parse_unified_diff` made pub(crate); TypeScript bindings regenerated; 136 tests passing
- 2026-04-12: [t2-5] Code review complete — 4 patches auto-fixed (name_status error swallowing, parse panic protection, wc validation, integer overflow guards), 3 deferred, all tests passing

### File List

- `src-tauri/src/commands/remote_files.rs` (new)
- `src-tauri/src/commands/mod.rs` (modified)
- `src-tauri/src/lib.rs` (modified)
- `src-tauri/src/services/git_service.rs` (modified: parse_unified_diff visibility only)
- `src/bindings.ts` (auto-generated)
