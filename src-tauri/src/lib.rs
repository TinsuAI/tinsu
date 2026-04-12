mod commands;
mod db;
mod error;
mod migration;
mod models;
mod services;

use sea_orm_migration::MigratorTrait;
use services::{
    hook_listener::HookListenerService,
    pty_service::PtyService,
    scrollback_backup::ScrollbackBackup,
    tmux_service::TmuxService,
};
use specta_typescript::Typescript;
use std::sync::{Arc, Mutex};
use tauri::Manager;
use tauri_specta::collect_commands;

use migration::Migrator;

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
    ])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = build_specta_builder();

    #[cfg(debug_assertions)]
    builder
        .export(Typescript::default(), "../src/bindings.ts")
        .expect("Failed to export TypeScript bindings");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(builder.invoke_handler())
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                let db = db::connect().await.expect("Failed to connect to database");
                Migrator::up(&db, None)
                    .await
                    .expect("Failed to run migrations");
                tracing::info!("Database initialized successfully");

                // Initialize services
                let tmux_service = Arc::new(TmuxService::new());
                let pty_service = Arc::new(PtyService::new());
                let app_data_dir = app_handle
                    .path()
                    .app_data_dir()
                    .expect("Failed to resolve app data dir");
                let scrollback_backup = Arc::new(ScrollbackBackup::new(app_data_dir));

                // Restore session state on startup
                commands::agent::restore_sessions_on_startup(&db, &tmux_service).await;
                services::chat_cli::validate_chat_sessions_on_startup(&db, &tmux_service).await;

                // Initialize hook listener
                let hook_db = db.clone();
                let hook_app = app_handle.clone();
                let mut hook_listener = HookListenerService::new(3847);
                let hook_state = Arc::new(services::hook_listener::HookListenerState {
                    app_handle: hook_app,
                    db: hook_db,
                    port: hook_listener.port,
                });
                if let Err(e) = hook_listener.start(hook_state).await {
                    tracing::warn!("Hook listener failed to start: {}", e);
                }

                app_handle.manage(tmux_service);
                app_handle.manage(pty_service);
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
