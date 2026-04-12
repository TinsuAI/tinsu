use sea_orm_migration::MigratorTrait;

mod m20260412_000001_initial_schema;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn sea_orm_migration::MigrationTrait>> {
        vec![Box::new(m20260412_000001_initial_schema::Migration)]
    }
}
