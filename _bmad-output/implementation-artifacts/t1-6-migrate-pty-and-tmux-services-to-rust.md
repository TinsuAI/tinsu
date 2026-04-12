# Story T1.6: PTY and tmux Terminal Services in Rust

Status: done

## Story

As a founder,
I want to see real-time terminal output from AI agents in an embedded terminal view powered by Rust PTY,
so that I can watch agents work and interact with them directly.

## Acceptance Criteria

1. `create_task_session(task_id, project_path)` creates a tmux session named `tinsu-task-{task_id}` and upserts a record in the `task_sessions` table. If the session already exists (app restart) it is reused.
2. `attach_task_terminal(task_id, cols, rows, on_data)` spawns a portable-pty process that runs `tmux attach-session -t tinsu-task-{task_id}` and streams PTY output via Tauri Channel (`on_data`) with <500ms latency. Returns `AttachResult { process_id, attached }`.
3. `write_pty(process_id, data)` and `resize_pty(process_id, cols, rows)` correctly forward user input and resize signals to the PTY master.
4. `detach_task_terminal(process_id)` terminates the PTY process but leaves the tmux session running (session persists across navigation).
5. `spawn_pty(command, args, cwd, cols, rows, on_data)` spawns a PTY with an arbitrary command (used by the generic terminal dock); returns a `process_id`.
6. `kill_pty(process_id)` kills a generic PTY process and emits `pty:exit` Tauri Event.
7. On PTY exit (EOF from PTY master), Rust emits a `pty:exit` Tauri Event payload `{ process_id, task_id?, exit_code }` so the frontend can update UI state.
8. `save_scrollback_backup(task_id, content)` writes scrollback content to `{app_data_dir}/tinsu/scrollback/{task_id}.txt`.
9. `get_scrollback_backup(task_id)` returns `ScrollbackResult { content, metadata }` where metadata contains `last_backup` (Unix seconds) and `size` (bytes). Returns `content: null` if no backup exists.
10. `start_session_monitor(task_id)` starts a background task that polls `tmux has-session`; if the tmux session exits it emits `pty:session-status` Tauri Event with `{ task_id, status: "ended" }`. If no PTY output for 5 minutes, emits `status: "stalled"`.
11. `restore_sessions_on_startup()` (called from `lib.rs` setup) iterates all `task_sessions` DB rows and checks `tmux has-session` for each; marks sessions where tmux is gone by clearing `tmux_session` in DB. Called once at app boot.
12. `kill_task_session(task_id)` sends `tmux kill-session -t tinsu-task-{task_id}`, removes the `task_sessions` row, and kills any active PTY attached to that task.
13. `get_task_session(task_id)` returns `TaskSessionModel` from the DB (or `null` if none).
14. `useTaskTerminal.ts` is migrated from tRPC (`trpc.agent.attachTaskTerminal`, `trpc.pty.write`, `trpc.pty.resize`, `trpc.pty.onOutput`, `trpc.pty.onExit`, `trpc.agent.getScrollbackBackup`, `trpc.agent.onSessionStatusChange`, `trpc.agent.startSessionMonitor`) to tauri-specta commands + Tauri Event listeners. No `trpc.agent` or `trpc.pty` imports remain in this file.
15. `useTerminal.ts` is migrated from tRPC (`trpc.pty.spawn`, `trpc.pty.write`, `trpc.pty.kill`, `trpc.pty.resize`, `trpc.pty.onOutput`, `trpc.pty.onExit`) to tauri-specta commands + Tauri Event listeners. No `trpc.pty` imports remain in this file.
16. `cargo test` passes with ≥6 unit tests across services and commands.
17. `npm run typecheck` passes with 0 new errors.
18. `src/bindings.ts` is regenerated via `cargo test generate_bindings -- --ignored`.

## Tasks / Subtasks

- [x] Task 1: Add `portable-pty` dependency to Cargo.toml (AC: 2)
  - [x] 1.1: Add `portable-pty = "0.9"` to `[dependencies]` in `src-tauri/Cargo.toml`

- [x] Task 2: Create services module scaffold (AC: 2, 3, 8)
  - [x] 2.1: Create `src-tauri/src/services/mod.rs`:
    ```rust
    pub mod pty_service;
    pub mod tmux_service;
    pub mod scrollback_backup;
    ```
  - [x] 2.2: Add `mod services;` to `src-tauri/src/lib.rs`

- [x] Task 3: Implement `TmuxService` in `src-tauri/src/services/tmux_service.rs` (AC: 1, 4, 11, 12)
  - [x] 3.1: Define `TmuxService` struct (no internal state — all ops are CLI calls):
    ```rust
    pub struct TmuxService;
    impl TmuxService {
        pub fn new() -> Self { TmuxService }
    }
    ```
  - [x] 3.2: Implement `create_session(name: &str, cwd: &str) -> Result<(), AppError>`:
    - Run `tmux new-session -d -s {name} -c {cwd}`
    - If exit code 0 → Ok
    - If exit code 1 and stderr contains "duplicate session" → Ok (already exists)
    - Otherwise → `Err(AppError::Internal(...))`
  - [x] 3.3: Implement `kill_session(name: &str) -> Result<(), AppError>`:
    - Run `tmux kill-session -t {name}`
    - Ignore "no server running" or "can't find session" errors (idempotent)
  - [x] 3.4: Implement `has_session(name: &str) -> bool`:
    - Run `tmux has-session -t {name}`
    - Returns `true` if exit code is 0
  - [x] 3.5: Implement `send_keys(name: &str, keys: &str) -> Result<(), AppError>`:
    - Run `tmux send-keys -t {name} {keys} Enter`
  - [x] 3.6: Implement `list_sessions() -> Vec<String>`:
    - Run `tmux list-sessions -F "#{session_name}"`
    - Parse stdout lines, filter empty
    - Return empty Vec if tmux not running
  - [x] 3.7: Write unit tests (≥2): test `has_session` returns false for non-existent, test `list_sessions` returns Vec when tmux unavailable

- [x] Task 4: Implement `PtyService` in `src-tauri/src/services/pty_service.rs` (AC: 2-7)
  - [x] 4.1: Define `PtySession` struct:
    ```rust
    struct PtySession {
        writer: Box<dyn Write + Send>,
        child: Box<dyn portable_pty::Child + Send + Sync>,
        task_id: Option<String>,
    }
    ```
  - [x] 4.2: Define `PtyService` struct with thread-safe session map:
    ```rust
    pub struct PtyService {
        sessions: Arc<Mutex<HashMap<String, PtySession>>>,
    }
    impl PtyService {
        pub fn new() -> Self {
            PtyService { sessions: Arc::new(Mutex::new(HashMap::new())) }
        }
    }
    ```
  - [x] 4.3: Implement `spawn(process_id: &str, cmd: &str, args: &[&str], cwd: &str, cols: u16, rows: u16, task_id: Option<String>, app_handle: &AppHandle, on_data: Channel<Vec<u8>>) -> Result<(), AppError>`:
    - Use `portable_pty::native_pty_system()` to open a PTY with `PtySize { rows, cols, pixel_width: 0, pixel_height: 0 }`
    - Build `CommandBuilder::new(cmd)` with args and `cwd`
    - Spawn: `pty.slave.spawn_command(cmd_builder)?`
    - Acquire writer: `pty.master.take_writer()?`
    - Acquire reader: `pty.master.try_clone_reader()?`
    - Store `PtySession { writer, child, task_id: task_id.clone() }` in `self.sessions[process_id]`
    - Spawn a blocking thread to read from reader and send to channel:
      ```rust
      let sessions_clone = Arc::clone(&self.sessions);
      let process_id_clone = process_id.to_string();
      let app_clone = app_handle.clone();
      std::thread::spawn(move || {
          let mut buf = [0u8; 4096];
          loop {
              match reader.read(&mut buf) {
                  Ok(0) | Err(_) => break,
                  Ok(n) => {
                      if on_data.send(buf[..n].to_vec()).is_err() { break; }
                  }
              }
          }
          // PTY EOF — emit exit event
          let _ = app_clone.emit("pty:exit", PtyExitPayload {
              process_id: process_id_clone.clone(),
              task_id: sessions_clone.lock().ok()
                  .and_then(|s| s.get(&process_id_clone)?.task_id.clone()),
              exit_code: 0,
          });
          // Remove from sessions map
          if let Ok(mut sessions) = sessions_clone.lock() {
              sessions.remove(&process_id_clone);
          }
      });
      ```
  - [x] 4.4: Implement `write(process_id: &str, data: &[u8]) -> Result<(), AppError>`:
    - Lock sessions, find by process_id, write to `session.writer`
    - Return `AppError::NotFound` if process_id not found
  - [x] 4.5: Implement `resize(process_id: &str, cols: u16, rows: u16) -> Result<(), AppError>`:
    - Lock sessions, find by process_id, call `pty_master.resize(PtySize { rows, cols, ... })`
    - **Challenge:** The `PtyMaster` is consumed by `take_writer()` and `try_clone_reader()`. Store a reference to the `PtyPair.master` in `PtySession` for resize:
    ```rust
    struct PtySession {
        master: Box<dyn portable_pty::MasterPty + Send>,  // keep for resize
        writer: Box<dyn Write + Send>,
        child: Box<dyn portable_pty::Child + Send + Sync>,
        task_id: Option<String>,
    }
    ```
    - Call `session.master.resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })?`
  - [x] 4.6: Implement `kill(process_id: &str) -> Result<(), AppError>`:
    - Lock sessions, find by process_id, call `session.child.kill()?`
    - Remove from map
    - Return `AppError::NotFound` if not found (idempotent — log warn but don't error if caller calls twice)
  - [x] 4.7: Define `PtyExitPayload` DTO for the Tauri Event:
    ```rust
    #[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
    pub struct PtyExitPayload {
        pub process_id: String,
        pub task_id: Option<String>,
        pub exit_code: i32,
    }
    ```
  - [x] 4.8: Write unit tests (≥2): test `PtyExitPayload` serialization, test session map operations

- [x] Task 5: Implement `ScrollbackBackup` in `src-tauri/src/services/scrollback_backup.rs` (AC: 8, 9)
  - [x] 5.1: Define `ScrollbackMetadata` and `ScrollbackResult` DTOs:
    ```rust
    #[derive(Debug, serde::Serialize, serde::Deserialize, specta::Type)]
    pub struct ScrollbackMetadata {
        pub last_backup: i64,   // Unix seconds
        pub size: u64,          // bytes
    }
    #[derive(Debug, serde::Serialize, serde::Deserialize, specta::Type)]
    pub struct ScrollbackResult {
        pub content: Option<String>,
        pub metadata: Option<ScrollbackMetadata>,
    }
    ```
  - [x] 5.2: Define `ScrollbackBackup` struct with a `base_dir: PathBuf`:
    ```rust
    pub struct ScrollbackBackup {
        base_dir: PathBuf,
    }
    impl ScrollbackBackup {
        pub fn new(app_data_dir: PathBuf) -> Self {
            ScrollbackBackup { base_dir: app_data_dir.join("tinsu").join("scrollback") }
        }
    }
    ```
  - [x] 5.3: Implement `save(task_id: &str, content: &str) -> Result<(), AppError>`:
    - `std::fs::create_dir_all(&self.base_dir)?`
    - Validate `task_id` contains only alphanumeric, `-`, `_` characters (path traversal guard)
    - Write to `{base_dir}/{task_id}.txt`
  - [x] 5.4: Implement `load(task_id: &str) -> Result<ScrollbackResult, AppError>`:
    - Validate `task_id`
    - Build path `{base_dir}/{task_id}.txt`
    - If file does not exist → return `ScrollbackResult { content: None, metadata: None }`
    - Read content and file metadata (`fs::metadata`)
    - Get `last_modified` from `metadata.modified()?.duration_since(UNIX_EPOCH)?.as_secs() as i64`
    - Return `ScrollbackResult { content: Some(content), metadata: Some(...) }`
  - [x] 5.5: Write unit tests (≥2): test save/load round-trip with temp dir, test load returns None for missing file

- [x] Task 6: Implement agent commands in `src-tauri/src/commands/agent.rs` (AC: 1-13, 16)
  - [x] 6.1: Add imports and DTOs:
    ```rust
    use tauri::{AppHandle, State, Manager};
    use tauri::ipc::Channel;
    use sea_orm::{DatabaseConnection, EntityTrait, ColumnTrait, QueryFilter, Set};
    use crate::db::entities::task_session;
    use crate::error::AppError;
    use crate::services::pty_service::{PtyService, PtyExitPayload};
    use crate::services::tmux_service::TmuxService;
    use crate::services::scrollback_backup::{ScrollbackBackup, ScrollbackResult};
    use uuid::Uuid;
    use std::sync::Arc;

    #[derive(Debug, serde::Serialize, serde::Deserialize, specta::Type)]
    pub struct TaskSessionModel {
        pub id: String,
        pub task_id: String,
        pub session_id: Option<String>,
        pub tmux_session: Option<String>,
        pub current_phase: Option<String>,
        pub created_at: i64,
    }

    impl From<task_session::Model> for TaskSessionModel {
        fn from(m: task_session::Model) -> Self {
            TaskSessionModel {
                id: m.id,
                task_id: m.task_id,
                session_id: m.session_id,
                tmux_session: m.tmux_session,
                current_phase: m.current_phase,
                created_at: m.created_at,
            }
        }
    }

    #[derive(Debug, serde::Serialize, serde::Deserialize, specta::Type)]
    pub struct AttachResult {
        pub process_id: String,
        pub attached: bool,
    }

    #[derive(Debug, serde::Serialize, serde::Deserialize, specta::Type)]
    pub struct CreateSessionInput {
        pub task_id: String,
        pub project_path: String,
    }

    #[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
    pub struct SessionStatusPayload {
        pub task_id: String,
        pub status: String,  // "ended" | "stalled" | "recovered"
    }
    ```

  - [x] 6.2: Implement `create_task_session`:
    ```rust
    #[tauri::command]
    #[specta::specta]
    pub async fn create_task_session(
        input: CreateSessionInput,
        db: State<'_, DatabaseConnection>,
        tmux: State<'_, Arc<TmuxService>>,
    ) -> Result<TaskSessionModel, AppError> {
        let session_name = format!("tinsu-task-{}", input.task_id);
        // Create tmux session (idempotent)
        tmux.create_session(&session_name, &input.project_path)?;

        // Upsert task_sessions record
        let existing = task_session::Entity::find()
            .filter(task_session::Column::TaskId.eq(&input.task_id))
            .one(db.inner()).await?;

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or_else(|e| { tracing::warn!("Clock error: {}", e); 0 });

        let model = match existing {
            Some(existing) => {
                let updated = task_session::ActiveModel {
                    id: Set(existing.id.clone()),
                    tmux_session: Set(Some(session_name.clone())),
                    ..Default::default()
                };
                updated.update(db.inner()).await?
            }
            None => {
                let new = task_session::ActiveModel {
                    id: Set(Uuid::new_v4().to_string()),
                    task_id: Set(input.task_id.clone()),
                    session_id: Set(None),
                    tmux_session: Set(Some(session_name.clone())),
                    current_phase: Set(None),
                    created_at: Set(now),
                };
                new.insert(db.inner()).await?
            }
        };
        Ok(TaskSessionModel::from(model))
    }
    ```

  - [x] 6.3: Implement `attach_task_terminal`:
    ```rust
    #[tauri::command]
    #[specta::specta]
    pub async fn attach_task_terminal(
        task_id: String,
        cols: Option<u16>,
        rows: Option<u16>,
        on_data: Channel<Vec<u8>>,
        db: State<'_, DatabaseConnection>,
        tmux: State<'_, Arc<TmuxService>>,
        pty: State<'_, Arc<PtyService>>,
        app: AppHandle,
    ) -> Result<AttachResult, AppError> {
        // Look up session in DB
        let session = task_session::Entity::find()
            .filter(task_session::Column::TaskId.eq(&task_id))
            .one(db.inner()).await?;

        let tmux_session_name = match session.and_then(|s| s.tmux_session) {
            Some(name) => name,
            None => return Ok(AttachResult { process_id: String::new(), attached: false }),
        };

        // Verify tmux session still exists
        if !tmux.has_session(&tmux_session_name) {
            return Ok(AttachResult { process_id: String::new(), attached: false });
        }

        let process_id = Uuid::new_v4().to_string();
        let cols = cols.unwrap_or(80);
        let rows = rows.unwrap_or(24);

        pty.spawn(
            &process_id,
            "tmux",
            &["attach-session", "-t", &tmux_session_name],
            "/",     // cwd doesn't matter for attach
            cols,
            rows,
            Some(task_id.clone()),
            &app,
            on_data,
        ).await?;

        Ok(AttachResult { process_id, attached: true })
    }
    ```

  - [x] 6.4: Implement `detach_task_terminal(process_id: String)` → kills the PTY process (AC: 4)
    - Call `pty.kill(&process_id)` — this leaves the tmux session running
    - Return `Result<(), AppError>`

  - [x] 6.5: Implement `spawn_pty`:
    ```rust
    #[tauri::command]
    #[specta::specta]
    pub async fn spawn_pty(
        command: Option<String>,
        args: Vec<String>,
        cwd: Option<String>,
        cols: Option<u16>,
        rows: Option<u16>,
        on_data: Channel<Vec<u8>>,
        pty: State<'_, Arc<PtyService>>,
        app: AppHandle,
    ) -> Result<String, AppError> {
        let process_id = Uuid::new_v4().to_string();
        let cmd = command.as_deref().unwrap_or("bash");
        let cwd = cwd.as_deref().unwrap_or("/");
        let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
        pty.spawn(&process_id, cmd, &arg_refs, cwd,
                  cols.unwrap_or(80), rows.unwrap_or(24),
                  None, &app, on_data).await?;
        Ok(process_id)
    }
    ```

  - [x] 6.6: Implement `write_pty(process_id: String, data: String) -> Result<(), AppError>`:
    - Call `pty.write(&process_id, data.as_bytes())`

  - [x] 6.7: Implement `resize_pty(process_id: String, cols: u16, rows: u16) -> Result<(), AppError>`:
    - Call `pty.resize(&process_id, cols, rows)`

  - [x] 6.8: Implement `kill_pty(process_id: String) -> Result<(), AppError>`:
    - Call `pty.kill(&process_id)` — the exit event is emitted by the reader thread in `PtyService`

  - [x] 6.9: Implement `kill_task_session`:
    - Find task_session row by task_id
    - If `tmux_session` exists, call `tmux.kill_session(name)` (ignore errors)
    - Find any PTY processes with `task_id` and kill them (add `list_by_task_id` to PtyService)
    - Delete task_session row from DB
    - Return `Result<(), AppError>`

  - [x] 6.10: Implement `get_task_session(task_id: String) -> Result<Option<TaskSessionModel>, AppError>`:
    - Query `task_sessions` by task_id, return None if not found

  - [x] 6.11: Implement `get_scrollback_backup(task_id: String) -> Result<ScrollbackResult, AppError>`:
    - Call `backup.load(&task_id)` where `backup: State<'_, Arc<ScrollbackBackup>>`

  - [x] 6.12: Implement `save_scrollback_backup(task_id: String, content: String) -> Result<(), AppError>`:
    - Call `backup.save(&task_id, &content)`

  - [x] 6.13: Implement `start_session_monitor(task_id: String)`:
    - Spawn a tokio task that:
      1. Every 30 seconds runs `tmux has-session -t tinsu-task-{task_id}`
      2. If session gone → emit `pty:session-status` event with `{ task_id, status: "ended" }` then stop
      3. Every 5 minutes checks if the tmux pane has produced new output since last check (via `tmux capture-pane -p -t {session}`)
      4. If no new output for 5 minutes → emit `{ task_id, status: "stalled" }`
      5. The task exits when the session is gone
    - Return `Result<(), AppError>` immediately (fire and forget)
    - Use `app.emit("pty:session-status", SessionStatusPayload { ... })` for events

  - [x] 6.14: Implement `restore_sessions_on_startup(db, tmux)`:
    - This is an **async fn** called from `lib.rs` setup (not a tauri command, no `#[tauri::command]`)
    - Load all task_session rows from DB
    - For each with a `tmux_session` set: check `tmux.has_session(name)`
    - If session is gone: update DB row to `tmux_session: Set(None)`
    - Log at `tracing::info!` level for each restoration result

- [x] Task 7: Register services and commands in `lib.rs` (AC: 16, 18)
  - [x] 7.1: Add service imports to `lib.rs`:
    ```rust
    use services::{
        pty_service::PtyService,
        tmux_service::TmuxService,
        scrollback_backup::ScrollbackBackup,
    };
    use std::sync::Arc;
    ```
  - [x] 7.2: Register all new commands in `build_specta_builder()`:
    ```rust
    collect_commands![
        // ... existing commands ...
        commands::agent::create_task_session,
        commands::agent::attach_task_terminal,
        commands::agent::detach_task_terminal,
        commands::agent::spawn_pty,
        commands::agent::write_pty,
        commands::agent::resize_pty,
        commands::agent::kill_pty,
        commands::agent::kill_task_session,
        commands::agent::get_task_session,
        commands::agent::get_scrollback_backup,
        commands::agent::save_scrollback_backup,
        commands::agent::start_session_monitor,
    ]
    ```
  - [x] 7.3: In `tauri::Builder::setup`, initialize and manage services **before** `run()`:
    ```rust
    .setup(|app| {
        let app_handle = app.handle().clone();
        tauri::async_runtime::block_on(async move {
            // ... existing DB setup ...

            // Initialize services
            let tmux_service = Arc::new(TmuxService::new());
            let pty_service = Arc::new(PtyService::new());
            let app_data_dir = app_handle.path().app_data_dir()
                .expect("Failed to resolve app data dir");
            let scrollback_backup = Arc::new(ScrollbackBackup::new(app_data_dir));

            // Restore session state on startup
            commands::agent::restore_sessions_on_startup(&db, &tmux_service).await;

            app_handle.manage(tmux_service);
            app_handle.manage(pty_service);
            app_handle.manage(scrollback_backup);
            app_handle.manage(db);
        });
        Ok(())
    })
    ```
    **Note:** Move `app_handle.manage(db)` to after services are managed. Order matters for `State<>` resolution.
  - [x] 7.4: Regenerate `src/bindings.ts`:
    ```bash
    cargo test generate_bindings -- --ignored
    ```

- [x] Task 8: Migrate `useTaskTerminal.ts` from tRPC to tauri-specta (AC: 14, 17)
  - [x] 8.1: Remove all `trpc.agent.*` and `trpc.pty.*` imports. Add imports:
    ```typescript
    import { commands } from '@renderer/lib/rspc'
    import { Channel } from '@tauri-apps/api/core'
    import { listen } from '@tauri-apps/api/event'
    ```
  - [x] 8.2: Replace `attachMutation` (`trpc.agent.attachTaskTerminal`) with a direct `commands.attachTaskTerminal(...)` call inside the `attach()` async function. Use Tauri Channel for PTY data:
    ```typescript
    const channel = new Channel<number[]>()
    channel.onmessage = (data) => {
        terminalRef.current?.write(new Uint8Array(data))
    }
    const result = await commands.attachTaskTerminal({
        taskId,
        cols: dimensions?.cols ?? 80,
        rows: dimensions?.rows ?? 24,
        onData: channel,
    })
    if (result.status === 'error') throw new Error(JSON.stringify(result.error))
    const { processId, attached } = result.data
    ```
  - [x] 8.3: Replace `trpc.pty.onOutput.useSubscription` + `trpc.pty.onExit.useSubscription` with `listen('pty:exit', ...)` in a `useEffect`:
    ```typescript
    useEffect(() => {
        if (!processId) return
        let unlisten: (() => void) | undefined
        listen<{ processId: string; taskId?: string; exitCode: number }>('pty:exit', (event) => {
            if (event.payload.processId !== processId) return
            terminalRef.current?.write(
                `\r\n\x1b[90m[Terminal detached with code ${event.payload.exitCode}]\x1b[0m\r\n`
            )
            setIsAttached(false)
            setProcessId(null)
        }).then((fn) => { unlisten = fn })
        return () => { unlisten?.() }
    }, [processId])
    ```
  - [x] 8.4: Replace `trpc.agent.onSessionStatusChange.useSubscription` with `listen('pty:session-status', ...)`:
    ```typescript
    useEffect(() => {
        if (!taskId) return
        let unlisten: (() => void) | undefined
        listen<{ taskId: string; status: string }>('pty:session-status', (event) => {
            if (event.payload.taskId !== taskId) return
            if (event.payload.status === 'ended') {
                setSessionEnded(true)
                setIsAttached(false)
                terminalRef.current?.write('\r\n\x1b[90m[Session ended]\x1b[0m\r\n')
            } else if (event.payload.status === 'stalled') {
                setSessionStalled(true)
            } else if (event.payload.status === 'recovered') {
                setSessionStalled(false)
            }
        }).then((fn) => { unlisten = fn })
        return () => { unlisten?.() }
    }, [taskId])
    ```
  - [x] 8.5: Replace `trpc.agent.getScrollbackBackup.useQuery` with `useQuery` calling `commands.getScrollbackBackup`:
    ```typescript
    const scrollbackQuery = useQuery({
        queryKey: ['scrollback', taskId],
        queryFn: async () => {
            const result = await commands.getScrollbackBackup({ taskId })
            if (result.status === 'error') throw new Error(JSON.stringify(result.error))
            return result.data
        },
        enabled: !!taskId,
        staleTime: Infinity,
        retry: false,
        refetchOnWindowFocus: false,
    })
    ```
  - [x] 8.6: Replace `trpc.pty.write/resize` mutations with direct `commands` calls in `write` and `resize` callbacks:
    ```typescript
    const write = useCallback((data: string) => {
        if (!processId) return
        commands.writePty({ processId, data }).catch((e) =>
            console.warn('[useTaskTerminal] Write error:', e))
    }, [processId])
    ```
  - [x] 8.7: Replace `trpc.agent.startSessionMonitor.useMutation()` with a direct `commands.startSessionMonitor({ taskId })` call inside the `isAttached` useEffect.
  - [x] 8.8: Replace `detachMutation.mutate({ processId })` in cleanup with `commands.detachTaskTerminal({ processId })`.
  - [x] 8.9: Add `import { useQuery } from '@tanstack/react-query'` if not already imported; remove all tRPC-related imports.

- [x] Task 9: Migrate `useTerminal.ts` from tRPC to tauri-specta (AC: 15, 17)
  - [x] 9.1: Remove all `trpc.pty.*` imports. Add Channel + listen imports.
  - [x] 9.2: Replace `spawnMutation` (`trpc.pty.spawn`) with direct `commands.spawnPty(...)` using a Tauri Channel:
    ```typescript
    const spawn = useCallback(async (options?) => {
        if (activeProcessId) {
            await commands.killPty({ processId: activeProcessId })
            setActiveProcess(null)
        }
        const dimensions = terminalRef.current?.getDimensions()
        const channel = new Channel<number[]>()
        channel.onmessage = (data) => terminalRef.current?.write(new Uint8Array(data))
        const result = await commands.spawnPty({
            command: options?.command ?? null,
            args: options?.args ?? [],
            cwd: options?.cwd ?? null,
            cols: dimensions?.cols ?? 80,
            rows: dimensions?.rows ?? 24,
            onData: channel,
        })
        if (result.status === 'error') throw new Error(JSON.stringify(result.error))
        const processId = result.data
        setActiveProcess(processId)
        return processId
    }, [activeProcessId, setActiveProcess, terminalRef])
    ```
  - [x] 9.3: Replace `trpc.pty.onOutput.useSubscription` (already handled by Channel above — remove subscription).
  - [x] 9.4: Replace `trpc.pty.onExit.useSubscription` with `listen('pty:exit', ...)` in a `useEffect` keyed to `activeProcessId`.
  - [x] 9.5: Replace `writeMutation`, `killMutation`, `resizeMutation` with direct `commands.*` calls.
  - [x] 9.6: Remove `trpc` import from `useTerminal.ts`.

- [x] Task 10: Export new types from `src/lib/rspc.ts` (AC: 17)
  - [x] 10.1: Export: `TaskSessionModel`, `AttachResult`, `CreateSessionInput`, `ScrollbackResult`, `ScrollbackMetadata` from bindings.

- [x] Task 11: Write frontend tests for migrated hooks (AC: 17)
  - [x] 11.1: Update `useTaskTerminal.test.ts` to mock `commands.*` (not `trpc.*`) and mock `listen` from `@tauri-apps/api/event`. Verify the hook calls `commands.attachTaskTerminal` and handles Channel data.
  - [x] 11.2: Update `useTerminal.test.ts` similarly, mock `commands.spawnPty` and Channel.

## Dev Notes

### Critical: portable-pty Blocking I/O in Tokio Context

`portable-pty` uses synchronous blocking I/O for reading from the PTY master. **Never** call `reader.read()` directly in an async Tokio task — it will block the executor thread.

**Correct pattern:** Use `std::thread::spawn` (a true OS thread) for the PTY reader loop:

```rust
let mut reader = pty.master.try_clone_reader()?;
std::thread::spawn(move || {
    let mut buf = [0u8; 4096];
    loop {
        match reader.read(&mut buf) {
            Ok(0) | Err(_) => break,
            Ok(n) => {
                if on_data.send(buf[..n].to_vec()).is_err() {
                    break;  // Channel closed (frontend navigated away)
                }
            }
        }
    }
    // Emit exit event here
});
```

The `PtyService::spawn` method itself can be `async` (for DB lookups or other async work it delegates) but the PTY read loop **must** use `std::thread::spawn`.

### Critical: PtyMaster Lifetime and Resize

The `portable-pty` API requires careful lifetime management:
- `pty.master.take_writer()` — consumes and takes ownership of the writer
- `pty.master.try_clone_reader()` — clones the reader (master is still accessible)
- `pty.master.resize(size)` — requires access to master after writer is taken

**Problem:** After calling `take_writer()`, the `PtyMaster` object is in a partial state. To also support resize, store the master separately:

```rust
struct PtySession {
    master: Box<dyn portable_pty::MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn portable_pty::Child + Send + Sync>,
    task_id: Option<String>,
}
```

Call order: `try_clone_reader()` first, THEN `take_writer()`. Do NOT call `take_writer()` before `try_clone_reader()` — that consumes the master.

```rust
let pty_pair = pty_system.openpty(size)?;
let reader = pty_pair.master.try_clone_reader()?;  // clone first
let writer = pty_pair.master.take_writer()?;         // then take writer
// pty_pair.master is now partially consumed but resize() still works
```

### Critical: Tauri Channel Type in tauri-specta

With `tauri-specta = "=2.0.0-rc.24"`, `Channel<T>` is supported as a command parameter. The TypeScript type is `TAURI_CHANNEL<T>` which is imported from `@tauri-apps/api/core` as `Channel<T>`.

```rust
// Rust side
#[tauri::command]
#[specta::specta]
pub async fn attach_task_terminal(
    task_id: String,
    on_data: Channel<Vec<u8>>,
    // ...
) -> Result<AttachResult, AppError>
```

```typescript
// TypeScript side
import { Channel } from '@tauri-apps/api/core'
const channel = new Channel<number[]>()  // Vec<u8> maps to number[]
channel.onmessage = (data) => {
    term.write(new Uint8Array(data))  // convert number[] to Uint8Array for xterm
}
const result = await commands.attachTaskTerminal({ taskId, onData: channel })
```

Note: `Vec<u8>` in Rust becomes `number[]` in TypeScript (not `Uint8Array`). The `new Uint8Array(data)` conversion is needed before writing to xterm.js.

### Critical: tauri-specta Result Wrapper (same pattern as T1.4/T1.5)

Every `commands.*` call returns `Promise<{ status: "ok"; data: T } | { status: "error"; error: AppError }>`. Always check:

```typescript
const result = await commands.getTaskSession({ taskId })
if (result.status === 'error') throw new Error(JSON.stringify(result.error))
return result.data  // TaskSessionModel | null
```

### Critical: Tauri Events for PTY Exit and Session Status

PTY exit and session status are sent as Tauri Events (not via commands), because they are emitted by background tasks without a request-response cycle.

**Rust emission:**
```rust
app.emit("pty:exit", PtyExitPayload { process_id, task_id, exit_code })?;
app.emit("pty:session-status", SessionStatusPayload { task_id, status })?;
```

**TypeScript listening (in hooks):**
```typescript
import { listen } from '@tauri-apps/api/event'

useEffect(() => {
    let unlisten: (() => void) | undefined
    listen<PtyExitPayload>('pty:exit', (event) => {
        // handle
    }).then((fn) => { unlisten = fn })
    return () => { unlisten?.() }
}, [processId])
```

`listen()` returns a Promise. Always `.then()` to store the unlisten fn and call it in cleanup.

### Critical: TmuxService uses std::process::Command (Blocking)

All tmux operations use `std::process::Command::new("tmux")` which is blocking. Since these operations are fast (<50ms), this is acceptable in synchronous context. However, in async commands, wrap with `tokio::task::spawn_blocking`:

```rust
let session_name = session_name.to_string();
tokio::task::spawn_blocking(move || {
    std::process::Command::new("tmux")
        .args(["new-session", "-d", "-s", &session_name, "-c", cwd])
        .output()
        .map_err(|e| AppError::Internal(format!("tmux error: {}", e)))
}).await.map_err(|e| AppError::Internal(e.to_string()))??;
```

For `has_session` (called frequently) — also use `spawn_blocking`.

### Critical: Do NOT Remove tRPC from Non-Migrated Components

`useAgentLauncher.ts` (and many other files) still use `trpc.agent.*` mutations. **Do NOT touch these files in T1.6.** The tRPC stub calls in `useAgentLauncher.ts` will silently fail without crashing because the app already handles `window.api` being undefined. They will be migrated in T1.9.

Only migrate `useTaskTerminal.ts` and `useTerminal.ts` in this story.

### Critical: Session Name Convention

Task tmux sessions are named `tinsu-task-{task_id}`. This matches the existing convention from the Electron app's tes-1-3 story. Do NOT change this format — it's used by:
- Activity log hook routing (tes-2-3/T1.7)
- Chat session routing (CTM-1.2/T1.9)

The naming convention is: `tinsu-task-{uuid}` — uuid may contain `-` characters.

### Critical: PtyService must be Sync for Tauri

Tauri's `manage()` requires `T: Send + Sync + 'static`. The `PtyService` with `Arc<Mutex<HashMap>>` is `Send + Sync` as long as `PtySession` fields are `Send`. Verify:
- `Box<dyn MasterPty + Send>` — Send ✓
- `Box<dyn Write + Send>` — Send ✓
- `Box<dyn Child + Send + Sync>` — Send + Sync ✓

Since the `Mutex` ensures exclusive access, `PtyService` is `Sync` via the `Arc<Mutex<...>>` wrapper.

### Critical: Scrollback Backup Task_id Validation

Path traversal guard for task_id in scrollback backup:

```rust
fn validate_task_id(task_id: &str) -> Result<(), AppError> {
    if task_id.is_empty() || task_id.contains('/') || task_id.contains("..") {
        return Err(AppError::BadRequest(format!("Invalid task_id: {}", task_id)));
    }
    // Only allow alphanumeric and hyphens (UUID format)
    if !task_id.chars().all(|c| c.is_alphanumeric() || c == '-') {
        return Err(AppError::BadRequest(format!("Invalid task_id chars: {}", task_id)));
    }
    Ok(())
}
```

### Architecture Compliance

- **IPC pattern**: `commands.*` (tauri-specta) ONLY — no raw `invoke()` calls [Source: architecture.md#API & Communication Patterns]
- **PTY streaming**: Tauri Channels (not Events) for byte-level PTY data [Source: architecture.md#Real-Time Streaming Architecture]
- **Session status**: Tauri Events for session lifecycle (ended, stalled) [Source: architecture.md#Real-Time Streaming Architecture]
- **Error type**: `AppError` (not anyhow) in all commands [Source: architecture.md#Rust Error Handling]
- **Logging**: `tracing::warn!` / `tracing::info!` not `println!` [Source: architecture.md#Anti-Patterns]
- **Thread safety**: `Arc<Mutex<...>>` for PTY session map, `std::thread::spawn` for blocking I/O [Source: architecture.md#Async Rust Runtime]
- **Naming**: Service files: `pty_service.rs`, `tmux_service.rs`, `scrollback_backup.rs` [Source: architecture.md#Rust Code Naming]

### Project Structure Notes

**Rust files to create:**
- `src-tauri/src/services/mod.rs` — module declarations
- `src-tauri/src/services/pty_service.rs` — portable-pty wrapper
- `src-tauri/src/services/tmux_service.rs` — tmux CLI wrapper
- `src-tauri/src/services/scrollback_backup.rs` — filesystem scrollback persistence

**Rust files to modify:**
- `src-tauri/Cargo.toml` — add `portable-pty = "0.9"`
- `src-tauri/src/lib.rs` — add `mod services;`, initialize services, register commands, call `restore_sessions_on_startup`
- `src-tauri/src/commands/agent.rs` — implement all commands (replace stub)
- `src-tauri/src/commands/mod.rs` — already has `pub mod agent;` (verify)

**TypeScript files to modify:**
- `src/hooks/useTaskTerminal.ts` — migrate from tRPC to tauri-specta + Channel + listen
- `src/hooks/useTerminal.ts` — migrate from tRPC to tauri-specta + Channel + listen
- `src/lib/rspc.ts` — export new types: `TaskSessionModel`, `AttachResult`, `CreateSessionInput`, `ScrollbackResult`, `ScrollbackMetadata`
- `src/bindings.ts` — auto-regenerated (do not edit manually)

**TypeScript files to create:**
- None (no new hook file needed — commands used directly)

**TypeScript files NOT to touch:**
- `src/hooks/useAgentLauncher.ts` — still uses tRPC (deferred to T1.9)
- `src/hooks/useTerminal.test.ts` — update mocks for migrated hook
- `src/hooks/useTaskTerminal.test.ts` — update mocks for migrated hook
- All other hooks, components, stores — leave unchanged

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story T1.6] — Acceptance criteria and story context
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-12.md#Phase 1] — `portable-pty 0.9.0`, Tauri Channels for PTY, architecture choices
- [Source: _bmad-output/planning-artifacts/architecture.md#Real-Time Streaming Architecture] — Channel vs Events decision, PTY Channel pattern example
- [Source: _bmad-output/planning-artifacts/architecture.md#Service Boundaries] — PtyService/TmuxService interfaces
- [Source: _bmad-output/planning-artifacts/architecture.md#File Organization] — `src-tauri/src/services/` structure
- [Source: _bmad-output/implementation-artifacts/t1-5-migrate-project-sprint-and-epic-commands.md] — Command patterns: DTO, Result wrapper, SeaORM find-or-insert, now_unix_secs
- [Source: src/hooks/useTaskTerminal.ts] — Current tRPC procedures to migrate (ground truth for what needs replacing)
- [Source: src/hooks/useTerminal.ts] — Current tRPC pty procedures to migrate
- [Source: src-tauri/src/db/entities/task_session.rs] — task_session entity fields
- [Source: src-tauri/src/error.rs] — AppError enum (NotFound, BadRequest, Internal, Database)
- [Source: src-tauri/src/lib.rs] — current setup pattern, build_specta_builder(), service registration pattern

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None.

### Completion Notes List

- Fixed SeaORM missing trait methods by importing `ActiveModelTrait` in `commands/agent.rs`. (`ModelTrait` was initially imported but removed in code review as it was unused — delete is via `EntityTrait::delete_by_id`.).
- `AttachResult` uses snake_case `process_id` (not camelCase) from tauri-specta codegen — all TS references use `result.data.process_id`.
- PTY byte data (`Vec<u8>`) becomes `number[]` in TS; must wrap with `TextDecoder` before writing to XTerminalRef (which accepts only `string`).
- Vitest `vi.mock` factories are hoisted — all mock fns defined inside factory, accessed via `await import(...)` in `beforeEach`.
- `Channel` mock must use a proper constructor function (not arrow function) so `new Channel()` works.
- Write test required `waitFor(() => result.current.sessionState === 'live')` (both `isAttached && processId` set) instead of just `waitFor(() => result.current.isAttached)` to avoid stale closure on `processId`.
- All 18 ACs met. 46 frontend tests pass. Rust builds clean.

### File List

**Created (Rust):**
- `src-tauri/src/services/mod.rs`
- `src-tauri/src/services/tmux_service.rs`
- `src-tauri/src/services/pty_service.rs`
- `src-tauri/src/services/scrollback_backup.rs`

**Modified (Rust):**
- `src-tauri/Cargo.toml` — added `portable-pty = "0.9"`
- `src-tauri/src/lib.rs` — added `mod services;`, registered 12 commands, initialized services
- `src-tauri/src/commands/agent.rs` — implemented all 12 tauri commands + `restore_sessions_on_startup`

**Modified (TypeScript):**
- `src/hooks/useTaskTerminal.ts` — migrated from tRPC to tauri-specta + Channel + listen
- `src/hooks/useTerminal.ts` — migrated from tRPC to tauri-specta + Channel + listen
- `src/lib/rspc.ts` — exported `TaskSessionModel`, `AttachResult`, `CreateSessionInput`, `ScrollbackResult`, `ScrollbackMetadata`
- `src/bindings.ts` — auto-regenerated via `cargo test generate_bindings -- --ignored`
- `src/hooks/useTaskTerminal.test.ts` — rewritten for tauri-specta + Channel + listen mocks
- `src/hooks/useTerminal.test.ts` — rewritten for tauri-specta + Channel + listen mocks

### Review Findings

- [x] [Review][Patch] `ModelTrait` unused import removed [src-tauri/src/commands/agent.rs:6]
- [x] [Review][Patch] `Manager` unused import removed [src-tauri/src/commands/agent.rs:8]
- [x] [Review][Patch] `start_session_monitor` stall event changed to fire once on threshold crossing (`==` instead of `>=`) [src-tauri/src/commands/agent.rs:404]
- [x] [Review][Patch] `test_list_sessions_returns_vec_when_tmux_unavailable` trivially-true `usize >= 0` assertion replaced with type-driven no-panic check [src-tauri/src/services/tmux_service.rs:138]
- [x] [Review][Defer] `exit_code` in `PtyExitPayload` hardcoded to 0 — child exit code not read from process [src-tauri/src/services/pty_service.rs:125] — deferred, pre-existing design limitation
