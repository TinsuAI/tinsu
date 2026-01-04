CREATE TABLE `settings` (
	`id` text PRIMARY KEY,
	`key` text NOT NULL UNIQUE,
	`value` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
