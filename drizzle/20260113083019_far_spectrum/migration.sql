CREATE TABLE `task_sessions` (
	`id` text PRIMARY KEY,
	`task_id` text NOT NULL UNIQUE,
	`session_id` text,
	`tmux_session` text NOT NULL,
	`current_phase` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_task_sessions_task_id_tasks_id_fk` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `context_notes` text;--> statement-breakpoint
CREATE INDEX `idx_task_sessions_session_id` ON `task_sessions` (`session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_task_sessions_task_id_unique` ON `task_sessions` (`task_id`);