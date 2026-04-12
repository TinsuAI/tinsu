use sea_orm_migration::prelude::*;

pub struct Migration;

impl MigrationName for Migration {
    fn name(&self) -> &str {
        "m20260412_000001_initial_schema"
    }
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let conn = manager.get_connection();

        // 1. projects (no FKs)
        conn.execute_unprepared(
            "CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY NOT NULL,
                path TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                created_at INTEGER NOT NULL DEFAULT (unixepoch()),
                last_opened_at INTEGER
            )",
        )
        .await?;
        conn.execute_unprepared(
            "CREATE INDEX IF NOT EXISTS idx_projects_path ON projects (path)",
        )
        .await?;
        conn.execute_unprepared(
            "CREATE INDEX IF NOT EXISTS idx_projects_last_opened ON projects (last_opened_at)",
        )
        .await?;

        // 2. settings (no FKs)
        conn.execute_unprepared(
            "CREATE TABLE IF NOT EXISTS settings (
                id TEXT PRIMARY KEY NOT NULL,
                key TEXT NOT NULL UNIQUE,
                value TEXT NOT NULL,
                created_at INTEGER NOT NULL DEFAULT (unixepoch())
            )",
        )
        .await?;
        conn.execute_unprepared(
            "CREATE INDEX IF NOT EXISTS idx_settings_key ON settings (key)",
        )
        .await?;

        // 3. sprints (FK → projects)
        conn.execute_unprepared(
            "CREATE TABLE IF NOT EXISTS sprints (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                start_date TEXT,
                end_date TEXT,
                status TEXT NOT NULL DEFAULT 'active',
                goal TEXT,
                velocity INTEGER,
                capacity INTEGER,
                project_id TEXT NOT NULL REFERENCES projects(id),
                story_prefix TEXT,
                epics_file_path TEXT,
                created_at INTEGER NOT NULL DEFAULT (unixepoch())
            )",
        )
        .await?;
        conn.execute_unprepared(
            "CREATE INDEX IF NOT EXISTS idx_sprints_project_id ON sprints (project_id)",
        )
        .await?;

        // 4. epics (FK → projects)
        conn.execute_unprepared(
            "CREATE TABLE IF NOT EXISTS epics (
                id TEXT PRIMARY KEY NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                color TEXT,
                epic_number INTEGER,
                goal TEXT,
                sprint_id TEXT,
                project_id TEXT NOT NULL REFERENCES projects(id),
                created_at INTEGER NOT NULL DEFAULT (unixepoch())
            )",
        )
        .await?;
        conn.execute_unprepared(
            "CREATE INDEX IF NOT EXISTS idx_epics_project_id ON epics (project_id)",
        )
        .await?;
        conn.execute_unprepared(
            "CREATE INDEX IF NOT EXISTS idx_epics_sprint_id ON epics (sprint_id)",
        )
        .await?;

        // 5. tasks (FK → projects; rejected_agent_run_id is plain TEXT — no FK constraint due to circular ref)
        conn.execute_unprepared(
            "CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                status TEXT NOT NULL DEFAULT 'backlog',
                sort_order INTEGER NOT NULL DEFAULT 0,
                epic_id TEXT,
                sprint_id TEXT,
                task_type TEXT NOT NULL DEFAULT 'basic',
                phase_number INTEGER,
                phase_name TEXT,
                bmad_agent TEXT,
                bmad_workflow TEXT,
                is_start_here INTEGER NOT NULL DEFAULT 0,
                artifact_path TEXT,
                story_number TEXT,
                story_file_path TEXT,
                full_content TEXT,
                story_file_status TEXT,
                context_notes TEXT,
                project_id TEXT NOT NULL REFERENCES projects(id),
                worktree_path TEXT,
                branch_name TEXT,
                merge_commit_sha TEXT,
                has_merge_conflict INTEGER NOT NULL DEFAULT 0,
                conflict_files TEXT,
                worktree_skipped INTEGER NOT NULL DEFAULT 0,
                rejection_feedback TEXT,
                rejected_agent_run_id TEXT,
                inline_comments TEXT,
                rejection_count INTEGER NOT NULL DEFAULT 0,
                last_review_commit TEXT,
                created_at INTEGER NOT NULL DEFAULT (unixepoch()),
                updated_at INTEGER NOT NULL DEFAULT (unixepoch())
            )",
        )
        .await?;
        conn.execute_unprepared(
            "CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks (project_id)",
        )
        .await?;
        conn.execute_unprepared(
            "CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status)",
        )
        .await?;
        conn.execute_unprepared(
            "CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id ON tasks (sprint_id)",
        )
        .await?;
        conn.execute_unprepared(
            "CREATE INDEX IF NOT EXISTS idx_tasks_epic_id ON tasks (epic_id)",
        )
        .await?;

        // 6. agent_runs (FK → tasks)
        conn.execute_unprepared(
            "CREATE TABLE IF NOT EXISTS agent_runs (
                id TEXT PRIMARY KEY NOT NULL,
                task_id TEXT NOT NULL REFERENCES tasks(id),
                start_time INTEGER,
                end_time INTEGER,
                duration_ms INTEGER,
                token_usage INTEGER,
                exit_status TEXT,
                log_path TEXT
            )",
        )
        .await?;
        conn.execute_unprepared(
            "CREATE INDEX IF NOT EXISTS idx_agent_runs_task_id ON agent_runs (task_id)",
        )
        .await?;

        // 7. planning_artifact_statuses (FK → projects)
        conn.execute_unprepared(
            "CREATE TABLE IF NOT EXISTS planning_artifact_statuses (
                id TEXT PRIMARY KEY NOT NULL,
                project_id TEXT NOT NULL REFERENCES projects(id),
                artifact_key TEXT NOT NULL,
                status TEXT NOT NULL,
                updated_at INTEGER NOT NULL DEFAULT (unixepoch())
            )",
        )
        .await?;
        conn.execute_unprepared(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_pas_project_artifact ON planning_artifact_statuses (project_id, artifact_key)",
        )
        .await?;

        // 8. task_artifacts (FK → tasks)
        conn.execute_unprepared(
            "CREATE TABLE IF NOT EXISTS task_artifacts (
                id TEXT PRIMARY KEY NOT NULL,
                task_id TEXT NOT NULL REFERENCES tasks(id),
                artifact_type TEXT NOT NULL,
                artifact_path TEXT NOT NULL,
                section_ref TEXT,
                created_at INTEGER NOT NULL DEFAULT (unixepoch())
            )",
        )
        .await?;
        conn.execute_unprepared(
            "CREATE INDEX IF NOT EXISTS idx_task_artifacts_task_id ON task_artifacts (task_id)",
        )
        .await?;

        // 9. task_sessions (FK → tasks, unique on task_id)
        conn.execute_unprepared(
            "CREATE TABLE IF NOT EXISTS task_sessions (
                id TEXT PRIMARY KEY NOT NULL,
                task_id TEXT NOT NULL UNIQUE REFERENCES tasks(id),
                session_id TEXT,
                tmux_session TEXT,
                current_phase TEXT,
                created_at INTEGER NOT NULL DEFAULT (unixepoch())
            )",
        )
        .await?;

        // 10. session_history (FK → tasks)
        conn.execute_unprepared(
            "CREATE TABLE IF NOT EXISTS session_history (
                id TEXT PRIMARY KEY NOT NULL,
                task_id TEXT NOT NULL REFERENCES tasks(id),
                session_id TEXT,
                workflow_type TEXT,
                started_at INTEGER,
                ended_at INTEGER
            )",
        )
        .await?;
        conn.execute_unprepared(
            "CREATE INDEX IF NOT EXISTS idx_session_history_task_id ON session_history (task_id)",
        )
        .await?;

        // 11. task_activities (FK → tasks)
        conn.execute_unprepared(
            "CREATE TABLE IF NOT EXISTS task_activities (
                id TEXT PRIMARY KEY NOT NULL,
                task_id TEXT NOT NULL REFERENCES tasks(id),
                event_type TEXT NOT NULL,
                payload TEXT,
                created_at INTEGER NOT NULL DEFAULT (unixepoch())
            )",
        )
        .await?;
        conn.execute_unprepared(
            "CREATE INDEX IF NOT EXISTS idx_task_activities_task_id ON task_activities (task_id)",
        )
        .await?;
        conn.execute_unprepared(
            "CREATE INDEX IF NOT EXISTS idx_task_activities_event_type ON task_activities (event_type)",
        )
        .await?;

        // 12. task_versions (FK → tasks)
        conn.execute_unprepared(
            "CREATE TABLE IF NOT EXISTS task_versions (
                id TEXT PRIMARY KEY NOT NULL,
                task_id TEXT NOT NULL REFERENCES tasks(id),
                version_number INTEGER NOT NULL,
                commit_sha TEXT,
                rejection_feedback TEXT,
                inline_comments TEXT,
                status_outcome TEXT,
                created_at INTEGER NOT NULL DEFAULT (unixepoch())
            )",
        )
        .await?;
        conn.execute_unprepared(
            "CREATE INDEX IF NOT EXISTS idx_task_versions_task_id ON task_versions (task_id)",
        )
        .await?;

        // 13. workflow_runs (FK → projects, tasks nullable)
        conn.execute_unprepared(
            "CREATE TABLE IF NOT EXISTS workflow_runs (
                id TEXT PRIMARY KEY NOT NULL,
                project_id TEXT NOT NULL REFERENCES projects(id),
                workflow_key TEXT NOT NULL,
                phase TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                started_at INTEGER,
                finished_at INTEGER,
                input_artifacts TEXT,
                output_artifacts TEXT,
                agent_name TEXT,
                task_id TEXT REFERENCES tasks(id)
            )",
        )
        .await?;
        conn.execute_unprepared(
            "CREATE INDEX IF NOT EXISTS idx_workflow_runs_project_id ON workflow_runs (project_id)",
        )
        .await?;
        conn.execute_unprepared(
            "CREATE INDEX IF NOT EXISTS idx_workflow_runs_task_id ON workflow_runs (task_id)",
        )
        .await?;

        // 14. gate_decisions (FK → projects, workflow_runs nullable)
        conn.execute_unprepared(
            "CREATE TABLE IF NOT EXISTS gate_decisions (
                id TEXT PRIMARY KEY NOT NULL,
                project_id TEXT NOT NULL REFERENCES projects(id),
                decision TEXT NOT NULL,
                rationale TEXT,
                issues TEXT,
                created_at INTEGER NOT NULL DEFAULT (unixepoch()),
                workflow_run_id TEXT REFERENCES workflow_runs(id)
            )",
        )
        .await?;
        conn.execute_unprepared(
            "CREATE INDEX IF NOT EXISTS idx_gate_decisions_project_id ON gate_decisions (project_id)",
        )
        .await?;

        // 15. chat_sessions (FK → projects)
        conn.execute_unprepared(
            "CREATE TABLE IF NOT EXISTS chat_sessions (
                id TEXT PRIMARY KEY NOT NULL,
                session_uuid TEXT NOT NULL UNIQUE,
                agent_persona TEXT,
                workflow_phase TEXT,
                project_id TEXT NOT NULL REFERENCES projects(id),
                status TEXT NOT NULL DEFAULT 'active',
                created_at INTEGER NOT NULL DEFAULT (unixepoch()),
                updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
                last_message_at INTEGER,
                workflow_key TEXT,
                skip_permissions INTEGER NOT NULL DEFAULT 0,
                tmux_session TEXT
            )",
        )
        .await?;
        conn.execute_unprepared(
            "CREATE INDEX IF NOT EXISTS idx_chat_sessions_project_id ON chat_sessions (project_id)",
        )
        .await?;
        conn.execute_unprepared(
            "CREATE INDEX IF NOT EXISTS idx_chat_sessions_uuid ON chat_sessions (session_uuid)",
        )
        .await?;

        // 16. chat_messages (FK → chat_sessions)
        conn.execute_unprepared(
            "CREATE TABLE IF NOT EXISTS chat_messages (
                id TEXT PRIMARY KEY NOT NULL,
                session_id TEXT NOT NULL REFERENCES chat_sessions(id),
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                tool_name TEXT,
                tool_input TEXT,
                created_at INTEGER NOT NULL DEFAULT (unixepoch())
            )",
        )
        .await?;
        conn.execute_unprepared(
            "CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages (session_id)",
        )
        .await?;

        // 17. chat_message_attachments (FK → chat_messages)
        conn.execute_unprepared(
            "CREATE TABLE IF NOT EXISTS chat_message_attachments (
                id TEXT PRIMARY KEY NOT NULL,
                message_id TEXT NOT NULL REFERENCES chat_messages(id),
                file_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                mime_type TEXT,
                file_size INTEGER,
                created_at INTEGER NOT NULL DEFAULT (unixepoch())
            )",
        )
        .await?;
        conn.execute_unprepared(
            "CREATE INDEX IF NOT EXISTS idx_chat_message_attachments_message_id ON chat_message_attachments (message_id)",
        )
        .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let conn = manager.get_connection();
        let drop_statements = [
            "DROP TABLE IF EXISTS chat_message_attachments",
            "DROP TABLE IF EXISTS chat_messages",
            "DROP TABLE IF EXISTS chat_sessions",
            "DROP TABLE IF EXISTS gate_decisions",
            "DROP TABLE IF EXISTS workflow_runs",
            "DROP TABLE IF EXISTS task_versions",
            "DROP TABLE IF EXISTS task_activities",
            "DROP TABLE IF EXISTS session_history",
            "DROP TABLE IF EXISTS task_sessions",
            "DROP TABLE IF EXISTS task_artifacts",
            "DROP TABLE IF EXISTS planning_artifact_statuses",
            "DROP TABLE IF EXISTS agent_runs",
            "DROP TABLE IF EXISTS tasks",
            "DROP TABLE IF EXISTS epics",
            "DROP TABLE IF EXISTS sprints",
            "DROP TABLE IF EXISTS settings",
            "DROP TABLE IF EXISTS projects",
        ];
        for stmt in &drop_statements {
            conn.execute_unprepared(stmt).await?;
        }
        Ok(())
    }
}
