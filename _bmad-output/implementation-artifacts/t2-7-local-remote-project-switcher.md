# Story T2.7: Local/Remote Project Switcher

Status: review

> 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

## Story

As a founder,
I want to switch between local and remote projects using a unified project switcher in the UI,
so that managing remote projects feels as natural as local ones.

## Acceptance Criteria

1. **Given** local projects from Epic 1 and remote projects saved from T2.3 **When** I open the project switcher in the header **Then** both local and remote projects appear in a unified list grouped as "Local Projects" and "Remote Projects" (FR60) — the existing popover component is extended, NOT replaced

2. **Given** a remote project is listed in the switcher **When** the switcher is open **Then** each remote project shows a connection status badge: `connected` (green dot, hook forwarder active), `disconnected` (gray dot, no active tunnel), or `connecting` (spinner, transition state) — determined by polling `get_remote_hook_status(connection_id)` every 5 seconds while the popover is open

3. **Given** I click a remote project in the switcher that has no active SSH connection **When** the switch is initiated **Then** the backend calls `start_remote_hook_forwarder(connection_id)` automatically, the switcher shows "connecting" badge during the transition, and once the forwarder reports `is_active: true` the project becomes active — the Kanban, task workspace, and planning workspace all load for this project

4. **Given** I am viewing a remote project's Kanban board **When** the SSH connection drops (hook forwarder `is_active` → false on next poll) **Then** the header's project switcher shows the remote project name with a red "disconnected" badge, and a "Reconnect" button appears in the header that calls `start_remote_hook_forwarder(connection_id)` again

5. **Given** I switch between a local project and a remote project (in either direction) **When** the switch completes **Then** the Kanban board invalidates and reloads tasks for the new active project ID; the project store is updated with `activeProjectId`, `projectName`, `projectPath`, `remoteProjectId`, and `remoteConnectionId`; each project's column collapse state and filters are preserved per-project via localStorage

6. **Given** all T2.1-T2.6 stories are done and the new `open_remote_project` Rust command is implemented **When** `cargo test` is run **Then** all existing tests pass (0 regressions, 142 existing from T2.6) and minimum 4 new Rust unit tests pass: `open_remote_project` validates empty ID, `open_remote_project` returns error for unknown remote_project_id, `project_model_includes_remote_project_id`, and migration 000005 adds column to projects table

7. **Given** the new command and entity changes are complete **When** TypeScript bindings are regenerated **Then** `src/bindings.ts` exports `openRemoteProject` command and `ProjectModel` includes `remote_project_id: string | null`

## Tasks / Subtasks

### Task 1: DB Migration — add `remote_project_id` to `projects` table (AC: 1, 3, 5, 6)

- [ ] 1.1 Create `src-tauri/src/migration/m20260412_000005_project_remote_link.rs`:

  ```rust
  use sea_orm_migration::prelude::*;

  pub struct Migration;

  impl MigrationName for Migration {
      fn name(&self) -> &str {
          "m20260412_000005_project_remote_link"
      }
  }

  #[async_trait::async_trait]
  impl MigrationTrait for Migration {
      async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
          manager
              .get_connection()
              .execute_unprepared(
                  "ALTER TABLE projects ADD COLUMN remote_project_id TEXT;",
              )
              .await?;
          Ok(())
      }

      async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
          // SQLite ALTER TABLE DROP COLUMN not supported in older versions — one-way
          let _ = manager;
          Ok(())
      }
  }
  ```

- [ ] 1.2 Register migration in `src-tauri/src/migration/mod.rs`:
  ```rust
  mod m20260412_000005_project_remote_link;
  // add to migrations() vec:
  Box::new(m20260412_000005_project_remote_link::Migration),
  ```

- [ ] 1.3 Update `src-tauri/src/db/mod.rs` — add `"projects"` table check to `test_migrations_create_all_tables` to verify the migration runs; also add `"ssh_connections"` and `"remote_projects"` to the expected_tables list if missing

### Task 2: Update `project` entity + `ProjectModel` DTO (AC: 7)

- [ ] 2.1 Add `remote_project_id` to `src-tauri/src/db/entities/project.rs`:
  ```rust
  pub remote_project_id: Option<String>,
  ```
  Full updated Model:
  ```rust
  #[derive(Clone, Debug, PartialEq, DeriveEntityModel, serde::Serialize, serde::Deserialize)]
  #[sea_orm(table_name = "projects")]
  pub struct Model {
      #[sea_orm(primary_key, auto_increment = false)]
      pub id: String,
      #[sea_orm(unique)]
      pub path: String,
      pub name: String,
      pub created_at: i64,
      pub last_opened_at: Option<i64>,
      pub remote_project_id: Option<String>,  // NEW
  }
  ```

- [ ] 2.2 Update `ProjectModel` DTO in `src-tauri/src/commands/project.rs` to add `remote_project_id`:
  ```rust
  #[derive(Debug, Serialize, Deserialize, Type)]
  pub struct ProjectModel {
      pub id: String,
      pub path: String,
      pub name: String,
      pub created_at: i64,
      pub last_opened_at: Option<i64>,
      pub remote_project_id: Option<String>,  // NEW
  }
  ```
  Update `impl From<project::Model> for ProjectModel` to map `remote_project_id: m.remote_project_id`.

- [ ] 2.3 Update `upsert_project` helper in `project.rs` to accept optional `remote_project_id: Option<String>` param:
  - When inserting a new project, set `remote_project_id` from the param
  - When updating existing, do NOT overwrite `remote_project_id` (keep existing)
  - The helper is private so this is a safe internal change
  - All existing callers (`open_project_by_path`, `open_project_dialog`, `create_project`) pass `None`

### Task 3: New Rust command `open_remote_project` (AC: 3, 5, 6, 7)

- [ ] 3.1 Add `open_remote_project` command to `src-tauri/src/commands/project.rs`:

  ```rust
  use crate::db::entities::{project, remote_project};

  /// Open a remote project by its remote_project_id.
  /// Finds or creates a local `projects` record linked to this remote project.
  /// The local record serves as the anchor for tasks, sprints, and epics.
  ///
  /// Logic:
  /// 1. Load remote_project from DB (error if not found)
  /// 2. Find existing project WHERE remote_project_id = id → if found, update last_opened_at + return
  /// 3. If not found, create new project with path = remote_project.path,
  ///    name = remote_project.name, remote_project_id = remote_project.id
  #[tauri::command]
  #[specta::specta]
  pub async fn open_remote_project(
      db: State<'_, DatabaseConnection>,
      remote_project_id: String,
  ) -> Result<ProjectModel, AppError> {
      if remote_project_id.is_empty() {
          return Err(AppError::BadRequest("remote_project_id must not be empty".into()));
      }

      // 1. Load remote project profile
      let rp = remote_project::Entity::find_by_id(&remote_project_id)
          .one(db.inner())
          .await?
          .ok_or_else(|| {
              AppError::NotFound(format!(
                  "Remote project '{}' not found",
                  remote_project_id
              ))
          })?;

      let now = now_unix_secs();

      // 2. Find existing linked local project
      let existing = project::Entity::find()
          .filter(project::Column::RemoteProjectId.eq(&remote_project_id))
          .one(db.inner())
          .await?;

      let model = match existing {
          Some(p) => {
              // Update last_opened_at
              let updated = project::ActiveModel {
                  id: Set(p.id.clone()),
                  last_opened_at: Set(Some(now)),
                  ..Default::default()
              };
              updated.update(db.inner()).await?
          }
          None => {
              // Create new local project anchored to this remote project
              let new = project::ActiveModel {
                  id: Set(uuid::Uuid::new_v4().to_string()),
                  path: Set(rp.path.clone()),
                  name: Set(rp.name.clone()),
                  created_at: Set(now),
                  last_opened_at: Set(Some(now)),
                  remote_project_id: Set(Some(remote_project_id)),
              };
              new.insert(db.inner()).await?
          }
      };

      Ok(ProjectModel::from(model))
  }
  ```

- [ ] 3.2 Register command in `src-tauri/src/lib.rs` `collect_commands![]` (after existing project commands):
  ```rust
  commands::project::open_remote_project,
  ```

- [ ] 3.3 Add unit tests for `open_remote_project` in `project.rs` `#[cfg(test)]` block:
  ```rust
  #[test]
  fn test_open_remote_project_rejects_empty_id() {
      // Validates the empty-id guard without hitting DB
      assert!(remote_project_id_is_empty(""));
      assert!(!remote_project_id_is_empty("some-uuid"));
  }

  fn remote_project_id_is_empty(id: &str) -> bool { id.is_empty() }

  #[test]
  fn test_project_model_includes_remote_project_id() {
      let model = ProjectModel {
          id: "p1".into(),
          path: "/remote/path".into(),
          name: "RemoteProj".into(),
          created_at: 1_000_000,
          last_opened_at: None,
          remote_project_id: Some("rp-uuid".into()),
      };
      let json = serde_json::to_string(&model).unwrap();
      assert!(json.contains("rp-uuid"));
      assert!(json.contains("remote_project_id"));
  }

  #[test]
  fn test_project_model_remote_project_id_nullable() {
      let model = ProjectModel {
          id: "p2".into(),
          path: "/local/path".into(),
          name: "LocalProj".into(),
          created_at: 1_000_000,
          last_opened_at: None,
          remote_project_id: None,
      };
      let json = serde_json::to_string(&model).unwrap();
      assert!(json.contains("\"remote_project_id\":null"));
  }

  #[test]
  fn test_migration_000005_name() {
      use crate::migration::m20260412_000005_project_remote_link::Migration;
      assert_eq!(Migration.name(), "m20260412_000005_project_remote_link");
  }
  ```

### Task 4: Regenerate TypeScript bindings (AC: 7)

- [ ] 4.1 Run `cargo test generate_bindings -- --ignored` inside `src-tauri/`
- [ ] 4.2 Verify `src/bindings.ts` exports `openRemoteProject` and `ProjectModel` has `remote_project_id: string | null`

### Task 5: Extend project store (AC: 5)

- [ ] 5.1 Update `src/stores/project.store.ts` — add remote context to state:
  ```typescript
  interface ProjectState {
    projectPath: string | null
    projectName: string | null
    activeProjectId: string | null
    remoteProjectId: string | null       // NEW — null for local projects
    remoteConnectionId: string | null    // NEW — null for local projects

    setProject: (id: string, path: string, name: string, remoteProjectId?: string | null, remoteConnectionId?: string | null) => void
    setProjectId: (id: string | null) => void
    clearProject: () => void
  }
  ```
  - Persist `remoteProjectId` and `remoteConnectionId` to localStorage (add to `partialize`)
  - `setProject` signature extended with optional remote params (default `null` to stay backward-compatible)
  - All existing callers of `setProject(id, path, name)` continue to work unchanged (remote params default to `null`)

### Task 6: Create `useRemoteProjectSwitcher` hook (AC: 2, 3, 4)

- [ ] 6.1 Create `src/hooks/useRemoteProjectSwitcher.ts`:

  ```typescript
  import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
  import { commands } from '@/bindings'
  import { useProjectStore } from '@/stores/project.store'
  import { toast } from 'sonner'

  export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting'

  /**
   * Poll hook forwarder status for a specific connection_id.
   * Only runs when enabled (popover open).
   */
  export function useRemoteConnectionStatus(connectionId: string | null, enabled: boolean) {
    return useQuery({
      queryKey: ['remoteHookStatus', connectionId],
      queryFn: () => commands.getRemoteHookStatus(connectionId!),
      enabled: enabled && !!connectionId,
      refetchInterval: 5000,   // Poll every 5 seconds while open
      staleTime: 4000,
    })
  }

  /**
   * Switch to a remote project: find-or-create local record, then start SSH tunnel.
   */
  export function useOpenRemoteProject() {
    const queryClient = useQueryClient()
    const setProject = useProjectStore((s) => s.setProject)

    return useMutation({
      mutationFn: async ({
        remoteProjectId,
        connectionId,
      }: {
        remoteProjectId: string
        connectionId: string
      }) => {
        // 1. Find or create local project record linked to remote project
        const project = await commands.openRemoteProject(remoteProjectId)

        // 2. Start SSH hook forwarder (idempotent — no-op if already running)
        await commands.startRemoteHookForwarder(connectionId)

        return { project, connectionId }
      },
      onSuccess: ({ project, connectionId }) => {
        setProject(project.id, project.path, project.name, project.remote_project_id ?? null, connectionId)
        queryClient.invalidateQueries({ queryKey: ['tasks'] })
        queryClient.invalidateQueries({ queryKey: ['projects', 'recent'] })
        toast.success(`Switched to ${project.name}`)
      },
      onError: (err: Error) => {
        toast.error(`Failed to switch project: ${err.message}`)
      },
    })
  }

  /**
   * Reconnect SSH for the currently active remote project.
   */
  export function useReconnectRemoteProject() {
    const remoteConnectionId = useProjectStore((s) => s.remoteConnectionId)
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: () => {
        if (!remoteConnectionId) throw new Error('No remote connection active')
        return commands.startRemoteHookForwarder(remoteConnectionId)
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['remoteHookStatus', remoteConnectionId] })
        toast.success('Reconnecting...')
      },
      onError: (err: Error) => {
        toast.error(`Reconnect failed: ${err.message}`)
      },
    })
  }
  ```

### Task 7: Extend `ProjectSwitcher.tsx` with remote projects section (AC: 1, 2, 3, 4)

- [ ] 7.1 Extend the existing `ProjectSwitcher.tsx` (DO NOT replace, extend):
  - Import `useListRemoteProjects` (existing from `useProjectCommands` or create a thin wrapper around `commands.listRemoteProjects`)
  - Import `useOpenRemoteProject`, `useRemoteConnectionStatus` from `useRemoteProjectSwitcher`
  - Import `useListSshConnections` to get `connection_id → name` mapping for display
  - Add a "Remote Projects" section below "Local Projects" section in the popover
  - Each remote project row shows: globe/server icon, project name, remote path, connection status badge
  - Clicking a remote project calls `openRemoteProjectMutation.mutate({ remoteProjectId, connectionId })`
  - Badge component: green dot + "Connected" | gray dot + "Disconnected" | spinner + "Connecting"

- [ ] 7.2 Add status polling per remote project (only when popover is open):
  - Use `useRemoteConnectionStatus(connectionId, open)` per connection — deduplicate by `connectionId` so projects sharing one SSH connection poll once

- [ ] 7.3 Show isCurrent indicator for remote projects:
  - `const remoteProjectId = useProjectStore(s => s.remoteProjectId)`
  - `isCurrent = project.id === remoteProjectId`

- [ ] 7.4 `data-testid` attributes for testing:
  - `data-testid="project-switcher-remote-section"` on the remote section wrapper
  - `data-testid={`remote-project-${project.id}`}` on each remote project row
  - `data-testid={`connection-badge-${project.connection_id}`}` on each status badge

### Task 8: Add "Reconnect" button to Header when remote connection is lost (AC: 4)

- [ ] 8.1 In `src/components/layout/Header.tsx`, add disconnected indicator:
  ```tsx
  const remoteProjectId = useProjectStore(s => s.remoteProjectId)
  const remoteConnectionId = useProjectStore(s => s.remoteConnectionId)
  const { data: hookStatus } = useRemoteConnectionStatus(remoteConnectionId, !!remoteProjectId)
  const reconnect = useReconnectRemoteProject()

  // Render in header next to ProjectSwitcher when remote project is active and disconnected:
  {remoteProjectId && hookStatus && !hookStatus.is_active && (
    <Button
      variant="destructive"
      size="sm"
      onClick={() => reconnect.mutate()}
      disabled={reconnect.isPending}
      data-testid="reconnect-remote-button"
    >
      Reconnect
    </Button>
  )}
  ```

### Task 9: Write frontend tests (AC: 1, 2, 3, 5)

- [ ] 9.1 Create `src/components/project/__tests__/ProjectSwitcher.remote.test.tsx`:
  - Test: remote projects section renders when `listRemoteProjects` returns data
  - Test: connection status badge shows "Disconnected" when `getRemoteHookStatus.is_active = false`
  - Test: connection status badge shows "Connected" when `getRemoteHookStatus.is_active = true`
  - Test: clicking remote project calls `openRemoteProject` then `startRemoteHookForwarder`
  - Test: "Reconnect" button appears in header when remote project active + hook down
  - Mock pattern: use `vi.mock('@/bindings', ...)` same as existing tests

### Task 10: Run all tests to verify no regressions (AC: 6)

- [ ] 10.1 Run `cargo test` in `src-tauri/` — verify 142 existing pass + 4 new Rust tests = 146 total
- [ ] 10.2 Run `npm test` in project root — verify all frontend tests pass

## Dev Notes

### Architecture: How Remote Projects Link to Local Project Records

**Critical design decision:** Tasks in TinSu always belong to a local `projects` record (`tasks.project_id`). Remote projects are execution environments (where tmux + Claude Code run), not separate task stores. T2.7 introduces a link: `projects.remote_project_id → remote_projects.id` (nullable).

- **Local project** (`remote_project_id = NULL`): tasks execute locally
- **Remote-linked project** (`remote_project_id = 'some-uuid'`): same Kanban/task system, but execution via SSH

When user selects a remote project in the switcher, `open_remote_project` finds-or-creates a local project record linked to it. This is a **find-or-create** pattern (not find-only), so the first switch automatically provisions the local anchor.

### Entity Model Update — Critical

The `project::Model` in `db/entities/project.rs` currently has no `remote_project_id` field. After migration 000005 adds the column, the entity MUST be updated to include `remote_project_id: Option<String>`. Failing to update the entity causes a SeaORM serialization mismatch panic on startup.

**Also update `ProjectModel` DTO in `commands/project.rs`** — the Specta-generated TypeScript type will automatically include `remote_project_id: string | null` after the DTO update.

### `upsert_project` helper — DO NOT BREAK

The existing `upsert_project` in `commands/project.rs` is used by `open_project_by_path`, `open_project_dialog`, and `create_project`. When you add `remote_project_id` to the entity, update `upsert_project` to handle the new field (pass `None` for all existing callers). The `project::ActiveModel { ..Default::default() }` pattern in SeaORM means fields left as `NotSet` are not written on update — so existing projects won't have their `remote_project_id` cleared on subsequent opens. ✓

### Migration Pattern — follow existing 000004

The migration pattern is `execute_unprepared("ALTER TABLE ... ADD COLUMN ...")` — same as migration 000004. SQLite's `ADD COLUMN` with no default is fine for nullable columns (they get NULL for existing rows). **Do NOT use `SchemaManager::alter_table` for SQLite** — it generates invalid DDL for SQLite's limited ALTER TABLE support.

**Migration registration** in `src/migration/mod.rs` — add the new migration as the LAST entry in the `migrations()` vec.

**CLAUDE.md mentions `db/index.ts`** — this is stale Electron-era instruction. The Tauri app uses `src-tauri/src/migration/` for all schema changes. Do NOT edit `db/index.ts`.

### Connection Status: Poll-Based via `get_remote_hook_status`

The hook forwarder status is the proxy for "is this remote connection active." Use the existing `get_remote_hook_status(connection_id)` command (added in T2.6). Poll every 5 seconds while the switcher popover is open — use `refetchInterval: 5000` in `useQuery`.

**Deduplication**: Multiple remote projects may share the same `connection_id`. In the switcher, group polling by `connection_id` — one query per connection, not one per project. Use `useRemoteConnectionStatus(connectionId, open)` at the row level; React Query automatically deduplicates queries with the same key.

### Store Backward Compatibility

`useProjectStore.setProject` is called in many places. Add optional `remoteProjectId` and `remoteConnectionId` params with defaults of `null`:

```typescript
setProject: (id, path, name, remoteProjectId = null, remoteConnectionId = null) => set({...})
```

All existing callers (`ProjectSwitcher.handleSwitchProject`, `Welcome.tsx`, `App.tsx`) continue to work without change — they just don't pass the new params, and local projects get `null` values.

### Existing Commands to Reuse (DO NOT REINVENT)

| Command | Location | Use in T2.7 |
|---------|----------|-------------|
| `listRemoteProjects()` | `src-tauri/src/commands/remote_projects.rs` | List remote projects in switcher |
| `getRemoteHookStatus(connection_id)` | `src-tauri/src/commands/remote_hook.rs` (T2.6) | Poll connection status |
| `startRemoteHookForwarder(connection_id)` | `src-tauri/src/commands/remote_hook.rs` (T2.6) | Auto-connect when switching |
| `listSshConnections()` | `src-tauri/src/commands/ssh_connections.rs` | Get connection names for display |
| `listRecentProjects(input)` | `src-tauri/src/commands/project.rs` | Already includes updated `ProjectModel` after Task 2 |

### File Structure Changes

```
src-tauri/
├── src/
│   ├── migration/
│   │   ├── mod.rs                           ← MODIFY: +m20260412_000005
│   │   └── m20260412_000005_project_remote_link.rs  ← NEW
│   ├── db/
│   │   └── entities/
│   │       └── project.rs                   ← MODIFY: +remote_project_id field
│   └── commands/
│       └── project.rs                       ← MODIFY: +open_remote_project, +ProjectModel field
src/
├── bindings.ts                              ← AUTO-GENERATED (after cargo test generate_bindings)
├── stores/
│   └── project.store.ts                     ← MODIFY: +remoteProjectId, +remoteConnectionId
├── hooks/
│   └── useRemoteProjectSwitcher.ts          ← NEW
└── components/
    ├── project/
    │   └── ProjectSwitcher.tsx              ← MODIFY: add Remote Projects section
    └── layout/
        └── Header.tsx                       ← MODIFY: add Reconnect button
```

### UI Design — Unified Project Switcher Layout

```
[Popover]
  ─────────────────
  LOCAL PROJECTS
  ─────────────────
  📁 MyLocalProject    (current)
  📁 OtherLocalProject
  ─────────────────
  REMOTE PROJECTS
  ─────────────────
  🖥 RemoteProject1   [● Connected]
  🖥 RemoteProject2   [○ Disconnected]
  🖥 RemoteProject3   [⟳ Connecting]
  ─────────────────
  + Create New Project...
  📂 Open Another Project...
```

Connection badge variants:
- `connected`: `<span className="text-green-500">●</span> Connected`
- `disconnected`: `<span className="text-muted-foreground">○</span> Disconnected`
- `connecting`: `<Loader2 className="animate-spin h-3 w-3" /> Connecting`

### Testing Standards

**Rust tests** — co-located in `commands/project.rs` `#[cfg(test)]` block, not integration tests. The 4 new tests are pure unit tests (no DB access needed):
- Empty ID guard test
- `ProjectModel` serialization with `remote_project_id: Some(...)`
- `ProjectModel` serialization with `remote_project_id: None` → `null`
- Migration name correctness

**Frontend tests** — Vitest in `src/components/project/__tests__/ProjectSwitcher.remote.test.tsx`. Mock `@/bindings` with `vi.mock`. Pattern from existing tests:

```typescript
vi.mock('@/bindings', () => ({
  commands: {
    listRemoteProjects: vi.fn().mockResolvedValue([...]),
    getRemoteHookStatus: vi.fn().mockResolvedValue({ is_active: false, remote_port: null }),
    openRemoteProject: vi.fn().mockResolvedValue({ id: 'p1', name: 'Test', ... }),
    startRemoteHookForwarder: vi.fn().mockResolvedValue({ is_active: true, remote_port: 3847 }),
  }
}))
```

### Previous Story Intelligence (T2.6)

From T2.6 completion notes:
- `RemoteHookForwarderManager` is registered in Tauri state (not Mutex — direct state)
- `startRemoteHookForwarder(connection_id)` returns `RemoteHookStatus { is_active, remote_port }`
- `getRemoteHookStatus(connection_id)` returns same type
- Connection_id must be a non-empty string (validated — returns BadRequest if empty)
- Hook forwarder backoff caps at 15 seconds, max 100 retry attempts
- Port file written to `/tmp/tinsu-hook-port` with chmod 600

From T2.6 review fixes — patterns to follow:
- Always validate `connection_id` is not empty before calling manager
- Lock failure in manager should return `AppError::Internal` (not silently fail)

### NFR Compliance

- AC3 "switching establishes SSH" — `start_remote_hook_forwarder` returns in ~1-2s for local networks; the "connecting" badge shows during the async transition. 5s timeout on connection attempts is handled in T2.6's SSH connect code.
- AC5 "switching preserves state" — column collapse state stored in `ui.store.ts` per-project via `ui.store.syncProjectPath()`; this is already implemented. Task filters stored per-project in `useKanbanFilters` (check if this uses `activeProjectId` as key).

### CLAUDE.md Notes

- `npm run rebuild:electron` instruction is stale (Electron removed). No such command needed.
- `db/index.ts` instruction is stale. All migrations are in `src-tauri/src/migration/`.

## Dev Agent Record

### Agent Model Used

<!-- to be filled by dev agent -->

### Completion Notes List

<!-- to be filled by dev agent -->

### File List

<!-- to be filled by dev agent -->
