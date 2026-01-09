ALTER TABLE `epics` ADD `epic_number` integer;--> statement-breakpoint
ALTER TABLE `epics` ADD `goal` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `story_number` integer;--> statement-breakpoint
ALTER TABLE `tasks` ADD `story_file_path` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `full_content` text;