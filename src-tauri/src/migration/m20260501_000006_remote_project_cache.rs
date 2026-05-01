use sea_orm_migration::prelude::*;

pub struct Migration;

impl MigrationName for Migration {
    fn name(&self) -> &str {
        "m20260501_000006_remote_project_cache"
    }
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let conn = manager.get_connection();

        // Table tracking per-remote-project local cache state.
        // One row per remote_project_id that has ever been opened on this device.
        conn.execute_unprepared(
            "CREATE TABLE IF NOT EXISTS remote_project_cache (
                remote_project_id  TEXT PRIMARY KEY NOT NULL,
                local_db_path      TEXT NOT NULL,
                last_pull_at       INTEGER,
                last_push_at       INTEGER,
                lease_device_id    TEXT,
                lease_expires_at   INTEGER
            )",
        )
        .await?;

        // Persist a stable device UUID in settings (key = 'device_id').
        // The application init code inserts it if absent; this migration just
        // ensures the settings table exists (it was created in migration 000001).
        // No schema change needed for settings — it is a key/value store.

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .get_connection()
            .execute_unprepared("DROP TABLE IF EXISTS remote_project_cache")
            .await?;
        Ok(())
    }
}
