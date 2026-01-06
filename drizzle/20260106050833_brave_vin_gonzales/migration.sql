ALTER TABLE `tasks` ADD `task_type` text DEFAULT 'story' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `phase_number` integer;--> statement-breakpoint
ALTER TABLE `tasks` ADD `phase_name` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `bmad_agent` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `bmad_workflow` text;--> statement-breakpoint
CREATE INDEX `idx_tasks_task_type` ON `tasks` (`task_type`);