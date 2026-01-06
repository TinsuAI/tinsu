CREATE TABLE `epics` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`description` text,
	`color` text DEFAULT 'blue' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sprints` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`start_date` integer,
	`end_date` integer,
	`is_active` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_tasks_sort_order` ON `tasks` (`sort_order`);