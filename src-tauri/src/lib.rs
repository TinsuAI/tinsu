mod commands;
mod db;
mod error;
mod migration;
mod models;
mod services;

use sea_orm_migration::MigratorTrait;
use services::{
    hook_listener::HookListenerService,
    remote_pty_service::RemotePtyService,
    scrollback_backup::ScrollbackBackup,
    tmux_service::TmuxService,
};
#[cfg(not(any(target_os = "android", target_os = "ios")))]
use services::pty_service::PtyService;
use specta_typescript::Typescript;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::Manager;
use tauri_specta::collect_commands;

use migration::Migrator;

#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub fn build_specta_builder() -> tauri_specta::Builder<tauri::Wry> {
    tauri_specta::Builder::<tauri::Wry>::new().commands(collect_commands![
        commands::task::get_task,
        commands::task::create_task,
        commands::task::list_tasks,
        commands::task::update_task_status,
        commands::task::reorder_tasks,
        commands::task::delete_task,
        commands::task::get_weekly_velocity,
        commands::epic::list_epics,
        commands::epic::create_epic,
        commands::epic::update_epic,
        commands::epic::delete_epic,
        commands::sprint::list_sprints,
        commands::sprint::create_sprint,
        commands::sprint::update_sprint,
        commands::sprint::update_sprint_status,
        commands::sprint::delete_sprint,
        commands::sprint::get_active_sprint,
        commands::project::list_recent_projects,
        commands::project::validate_project_path,
        commands::project::open_project_by_path,
        commands::project::remove_project,
        commands::project::open_project_dialog,
        commands::project::select_parent_directory,
        commands::project::create_project,
        commands::project::verify_tools,
        commands::project::open_remote_project,
        commands::project::list_project_files,
        commands::project::search_project_files,
        commands::bmad::bmad_check_status,
        commands::bmad::bmad_install_to_path,
        commands::bmad::install_nodejs,
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
        commands::agent::register_session_id,
        commands::activity::log_activity,
        commands::activity::list_activities_for_task,
        commands::git::get_task_diff,
        commands::git::get_branch_status,
        commands::review::approve_task,
        commands::review::reject_task,
        commands::chat::create_chat_session,
        commands::chat::list_chat_sessions_with_preview,
        commands::chat::get_chat_messages,
        commands::chat::send_chat_message,
        commands::chat::update_session_status,
        commands::chat::delete_chat_session,
        commands::chat::delete_chat_message,
        commands::chat::clear_session_messages,
        commands::chat::update_skip_permissions,
        commands::chat::get_chat_session_by_workflow_key,
        commands::chat::attach_chat_terminal,
        commands::chat::detach_chat_terminal,
        commands::planning::scan_artifacts,
        commands::planning::get_artifact_content,
        commands::planning::update_artifact_status,
        commands::planning::create_workflow_run,
        commands::planning::update_workflow_run,
        commands::planning::list_workflow_runs,
        commands::planning::get_active_workflow_run,
        commands::planning::parse_and_save_gate_result,
        commands::planning::get_latest_gate_decision,
        commands::planning::list_gate_decisions,
        commands::planning::approve_for_implementation,
        commands::ssh::generate_ssh_key,
        commands::ssh::install_ssh_key,
        commands::ssh::list_ssh_keys,
        commands::ssh::get_ssh_public_key,
        commands::ssh::export_ssh_key,
        commands::ssh::delete_ssh_key,
        commands::ssh_connections::list_ssh_connections,
        commands::ssh_connections::create_ssh_connection,
        commands::ssh_connections::update_ssh_connection,
        commands::ssh_connections::delete_ssh_connection,
        commands::ssh_connections::test_ssh_connection,
        commands::remote_projects::discover_remote_projects,
        commands::remote_projects::list_remote_dir,
        commands::remote_projects::save_remote_project,
        commands::remote_projects::list_remote_projects,
        commands::remote_projects::delete_remote_project,
        commands::remote_agent::create_remote_task_session,
        commands::remote_agent::attach_remote_task_terminal,
        commands::remote_agent::write_remote_pty,
        commands::remote_agent::resize_remote_pty,
        commands::remote_agent::detach_remote_task_terminal,
        commands::remote_files::get_remote_task_diff,
        commands::remote_files::read_remote_file,
        commands::remote_files::list_remote_project_files,
        commands::remote_files::search_remote_project_files,
        commands::remote_hook::start_remote_hook_forwarder,
        commands::remote_hook::stop_remote_hook_forwarder,
        commands::remote_hook::get_remote_hook_status,
    ])
}

#[cfg(any(target_os = "android", target_os = "ios"))]
pub fn build_specta_builder() -> tauri_specta::Builder<tauri::Wry> {
    tauri_specta::Builder::<tauri::Wry>::new().commands(collect_commands![
        commands::task::get_task,
        commands::task::create_task,
        commands::task::list_tasks,
        commands::task::update_task_status,
        commands::task::reorder_tasks,
        commands::task::delete_task,
        commands::task::get_weekly_velocity,
        commands::epic::list_epics,
        commands::epic::create_epic,
        commands::epic::update_epic,
        commands::epic::delete_epic,
        commands::sprint::list_sprints,
        commands::sprint::create_sprint,
        commands::sprint::update_sprint,
        commands::sprint::update_sprint_status,
        commands::sprint::delete_sprint,
        commands::sprint::get_active_sprint,
        commands::project::list_recent_projects,
        commands::project::validate_project_path,
        commands::project::open_project_by_path,
        commands::project::remove_project,
        commands::project::open_project_dialog,
        commands::project::select_parent_directory,
        commands::project::create_project,
        commands::project::verify_tools,
        commands::project::open_remote_project,
        commands::bmad::bmad_check_status,
        commands::bmad::bmad_install_to_path,
        commands::bmad::install_nodejs,
        commands::agent::create_task_session,
        // Desktop-only commands excluded: attach_task_terminal, detach_task_terminal,
        // spawn_pty, write_pty, resize_pty, kill_pty (use remote_agent equivalents)
        commands::agent::kill_task_session,
        commands::agent::get_task_session,
        commands::agent::get_scrollback_backup,
        commands::agent::save_scrollback_backup,
        commands::agent::start_session_monitor,
        commands::agent::register_session_id,
        commands::activity::log_activity,
        commands::activity::list_activities_for_task,
        commands::git::get_task_diff,
        commands::git::get_branch_status,
        commands::review::approve_task,
        commands::review::reject_task,
        commands::chat::create_chat_session,
        commands::chat::list_chat_sessions_with_preview,
        commands::chat::get_chat_messages,
        commands::chat::send_chat_message,
        commands::chat::update_session_status,
        commands::chat::delete_chat_session,
        commands::chat::delete_chat_message,
        commands::chat::clear_session_messages,
        commands::chat::update_skip_permissions,
        commands::chat::get_chat_session_by_workflow_key,
        // Desktop-only commands excluded: attach_chat_terminal, detach_chat_terminal
        commands::planning::scan_artifacts,
        commands::planning::get_artifact_content,
        commands::planning::update_artifact_status,
        commands::planning::create_workflow_run,
        commands::planning::update_workflow_run,
        commands::planning::list_workflow_runs,
        commands::planning::get_active_workflow_run,
        commands::planning::parse_and_save_gate_result,
        commands::planning::get_latest_gate_decision,
        commands::planning::list_gate_decisions,
        commands::planning::approve_for_implementation,
        commands::ssh::generate_ssh_key,
        commands::ssh::install_ssh_key,
        commands::ssh::list_ssh_keys,
        commands::ssh::get_ssh_public_key,
        commands::ssh::export_ssh_key,
        commands::ssh::delete_ssh_key,
        commands::ssh_connections::list_ssh_connections,
        commands::ssh_connections::create_ssh_connection,
        commands::ssh_connections::update_ssh_connection,
        commands::ssh_connections::delete_ssh_connection,
        commands::ssh_connections::test_ssh_connection,
        commands::remote_projects::discover_remote_projects,
        commands::remote_projects::list_remote_dir,
        commands::remote_projects::save_remote_project,
        commands::remote_projects::list_remote_projects,
        commands::remote_projects::delete_remote_project,
        commands::remote_agent::create_remote_task_session,
        commands::remote_agent::attach_remote_task_terminal,
        commands::remote_agent::write_remote_pty,
        commands::remote_agent::resize_remote_pty,
        commands::remote_agent::detach_remote_task_terminal,
        commands::remote_files::get_remote_task_diff,
        commands::remote_files::read_remote_file,
        commands::remote_hook::start_remote_hook_forwarder,
        commands::remote_hook::stop_remote_hook_forwarder,
        commands::remote_hook::get_remote_hook_status,
    ])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize tracing subscriber so tracing::info!/warn!/error! actually emit to stderr.
    // RUST_LOG can override (e.g. RUST_LOG=tinsu=debug); default to info for our crate.
    let _ = tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("tinsu=info,warn")),
        )
        .with_target(true)
        .with_writer(std::io::stderr)
        .try_init();

    tracing::info!("tinsu starting up — tracing subscriber initialized");

    let builder = build_specta_builder();

    #[cfg(all(debug_assertions, not(target_os = "android"), not(target_os = "ios")))]
    builder
        .export(Typescript::default(), "../src/bindings.ts")
        .expect("Failed to export TypeScript bindings");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(builder.invoke_handler())
        .setup(|app| {
            let app_handle = app.handle().clone();
            let app_data_dir = app_handle
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data dir");
            tauri::async_runtime::block_on(async move {
                let db = db::connect(&app_data_dir).await.expect("Failed to connect to database");
                Migrator::up(&db, None)
                    .await
                    .expect("Failed to run migrations");
                tracing::info!("Database initialized successfully");

                // Initialize services
                let tmux_service = Arc::new(TmuxService::new());
                #[cfg(not(any(target_os = "android", target_os = "ios")))]
                let pty_service = Arc::new(PtyService::new());
                let scrollback_backup = Arc::new(ScrollbackBackup::new(app_data_dir));

                // Restore session state on startup
                commands::agent::restore_sessions_on_startup(&db, &tmux_service).await;
                services::chat_cli::validate_chat_sessions_on_startup(&db, &tmux_service).await;

                // Spawn periodic stale-session health monitor (every 30s)
                let db_clone = db.clone();
                let tmux_clone = Arc::clone(&tmux_service);
                let app_handle_clone = app_handle.clone();
                tokio::spawn(async move {
                    loop {
                        tokio::time::sleep(Duration::from_secs(30)).await;
                        services::chat_cli::check_and_update_stale_sessions(
                            &db_clone,
                            &tmux_clone,
                            &app_handle_clone,
                        )
                        .await;
                    }
                });

                // Initialize hook listener
                let hook_db = db.clone();
                let hook_app = app_handle.clone();
                let mut hook_listener = HookListenerService::new(3847);
                let hook_state = Arc::new(services::hook_listener::HookListenerState {
                    app_handle: hook_app,
                    db: hook_db,
                    port: hook_listener.port,
                    turn_text_extracted: Arc::new(std::sync::Mutex::new(
                        std::collections::HashMap::new(),
                    )),
                });
                if let Err(e) = hook_listener.start(hook_state).await {
                    tracing::warn!("Hook listener failed to start: {}", e);
                }

                let remote_pty_service = Arc::new(RemotePtyService::new());
                app_handle.manage(tmux_service);
                #[cfg(not(any(target_os = "android", target_os = "ios")))]
                app_handle.manage(pty_service);
                app_handle.manage(remote_pty_service);
                app_handle.manage(
                    crate::services::remote_hook_forwarder::RemoteHookForwarderManager::new(),
                );
                app_handle.manage(scrollback_backup);
                app_handle.manage(Mutex::new(hook_listener));
                app_handle.manage(db);
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Some(state) = window
                    .app_handle()
                    .try_state::<Mutex<HookListenerService>>()
                {
                    if let Ok(mut listener) = state.lock() {
                        listener.stop();
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use specta_typescript::Typescript;
    use std::path::PathBuf;

    #[test]
    fn test_specta_builder_builds() {
        let builder = build_specta_builder();
        // Verify builder builds without panicking by exporting to a temp path
        let temp_dir = std::env::temp_dir();
        let bindings_path = temp_dir.join(format!(
            "tinsu_bindings_test_{}.ts",
            std::process::id()
        ));
        builder
            .export(Typescript::default(), &bindings_path)
            .expect("Failed to export TypeScript bindings");
        assert!(
            bindings_path.exists(),
            "bindings file should be created by export"
        );
        let _ = std::fs::remove_file(&bindings_path);
    }

    #[test]
    #[ignore]
    fn generate_bindings() {
        let builder = build_specta_builder();
        let out_path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../src/bindings.ts");
        builder
            .export(Typescript::default(), &out_path)
            .expect("Failed to generate TypeScript bindings");
    }
}
