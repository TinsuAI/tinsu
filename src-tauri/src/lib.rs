mod commands;
mod db;
mod error;
mod migration;
mod models;

use sea_orm_migration::MigratorTrait;
use specta_typescript::Typescript;
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
        commands::epic::list_epics,
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
        .invoke_handler(builder.invoke_handler())
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                let db = db::connect().await.expect("Failed to connect to database");
                Migrator::up(&db, None)
                    .await
                    .expect("Failed to run migrations");
                tracing::info!("Database initialized successfully");
                app_handle.manage(db);
            });
            Ok(())
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
