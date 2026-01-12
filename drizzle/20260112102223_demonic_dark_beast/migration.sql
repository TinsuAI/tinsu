PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tasks` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'backlog' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`epic_id` text,
	`sprint_id` text,
	`task_type` text DEFAULT 'story' NOT NULL,
	`phase_number` integer,
	`phase_name` text,
	`bmad_agent` text,
	`bmad_workflow` text,
	`is_start_here` integer,
	`artifact_path` text,
	`story_number` text,
	`story_file_path` text,
	`full_content` text,
	`story_file_status` text,
	`project_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_tasks_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_tasks`(`id`, `title`, `description`, `status`, `sort_order`, `epic_id`, `sprint_id`, `task_type`, `phase_number`, `phase_name`, `bmad_agent`, `bmad_workflow`, `is_start_here`, `artifact_path`, `story_number`, `story_file_path`, `full_content`, `story_file_status`, `project_id`, `created_at`, `updated_at`) SELECT `id`, `title`, `description`, `status`, `sort_order`, `epic_id`, `sprint_id`, `task_type`, `phase_number`, `phase_name`, `bmad_agent`, `bmad_workflow`, `is_start_here`, `artifact_path`, `story_number`, `story_file_path`, `full_content`, `story_file_status`, `project_id`, `created_at`, `updated_at` FROM `tasks`;--> statement-breakpoint
DROP TABLE `tasks`;--> statement-breakpoint
ALTER TABLE `__new_tasks` RENAME TO `tasks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_tasks_status` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `idx_tasks_epic_id` ON `tasks` (`epic_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_sprint_id` ON `tasks` (`sprint_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_sort_order` ON `tasks` (`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_tasks_task_type` ON `tasks` (`task_type`);--> statement-breakpoint
CREATE INDEX `idx_tasks_project_id` ON `tasks` (`project_id`);