CREATE TABLE `agent_runs` (
	`id` text PRIMARY KEY,
	`task_id` text NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer,
	`duration_ms` integer,
	`token_usage` integer,
	`exit_status` text,
	`log_path` text,
	CONSTRAINT `fk_agent_runs_task_id_tasks_id_fk` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'backlog' NOT NULL,
	`epic_id` text,
	`sprint_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_agent_runs_task_id` ON `agent_runs` (`task_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_status` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `idx_tasks_epic_id` ON `tasks` (`epic_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_sprint_id` ON `tasks` (`sprint_id`);