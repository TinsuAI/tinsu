use sea_orm::{Database, DatabaseConnection, DbErr};

pub mod entities;

pub async fn connect() -> Result<DatabaseConnection, DbErr> {
    std::fs::create_dir_all("data").expect("Failed to create data directory");
    Database::connect("sqlite://./data/tinsu.db?mode=rwc").await
}

#[cfg(test)]
mod tests {
    use crate::migration::Migrator;
    use sea_orm_migration::MigratorTrait;
    use sea_orm::{ConnectionTrait, Database, DbBackend, Statement};

    #[tokio::test]
    async fn test_migrations_create_all_tables() {
        let db = Database::connect("sqlite::memory:").await.unwrap();
        Migrator::up(&db, None).await.unwrap();

        let expected_tables = vec![
            "projects",
            "settings",
            "sprints",
            "epics",
            "tasks",
            "agent_runs",
            "planning_artifact_statuses",
            "task_artifacts",
            "task_sessions",
            "session_history",
            "task_activities",
            "task_versions",
            "workflow_runs",
            "gate_decisions",
            "chat_sessions",
            "chat_messages",
            "chat_message_attachments",
        ];

        for table in expected_tables {
            let result = db
                .query_one(Statement::from_sql_and_values(
                    DbBackend::Sqlite,
                    "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                    [table.into()],
                ))
                .await
                .unwrap();
            assert!(result.is_some(), "Table '{}' should exist", table);
        }
    }
}
