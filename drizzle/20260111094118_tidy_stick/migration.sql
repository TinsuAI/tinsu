CREATE TABLE `task_artifacts` (
	`id` text PRIMARY KEY,
	`task_id` text NOT NULL,
	`artifact_type` text NOT NULL,
	`artifact_path` text NOT NULL,
	`section_ref` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_task_artifacts_task_id_tasks_id_fk` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `idx_task_artifacts_task_id` ON `task_artifacts` (`task_id`);