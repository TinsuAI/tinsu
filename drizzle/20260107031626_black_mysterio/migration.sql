CREATE TABLE `projects` (
	`id` text PRIMARY KEY,
	`path` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_opened_at` integer
);
--> statement-breakpoint
ALTER TABLE `epics` ADD `project_id` text REFERENCES projects(id);--> statement-breakpoint
ALTER TABLE `sprints` ADD `project_id` text REFERENCES projects(id);--> statement-breakpoint
ALTER TABLE `tasks` ADD `artifact_path` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `project_id` text REFERENCES projects(id);--> statement-breakpoint
CREATE INDEX `idx_epics_project_id` ON `epics` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_projects_path` ON `projects` (`path`);--> statement-breakpoint
CREATE INDEX `idx_projects_last_opened` ON `projects` (`last_opened_at`);--> statement-breakpoint
CREATE INDEX `idx_sprints_project_id` ON `sprints` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_project_id` ON `tasks` (`project_id`);