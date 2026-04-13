use sea_orm_migration::MigratorTrait;

mod m20260412_000001_initial_schema;
mod m20260412_000002_ssh_connections;
mod m20260412_000003_remote_projects;
mod m20260412_000004_remote_task_sessions;
pub mod m20260412_000005_project_remote_link;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn sea_orm_migration::MigrationTrait>> {
        vec![
            Box::new(m20260412_000001_initial_schema::Migration),
            Box::new(m20260412_000002_ssh_connections::Migration),
            Box::new(m20260412_000003_remote_projects::Migration),
            Box::new(m20260412_000004_remote_task_sessions::Migration),
            Box::new(m20260412_000005_project_remote_link::Migration),
        ]
    }
}
