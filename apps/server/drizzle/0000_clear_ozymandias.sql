CREATE TABLE `assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`path` text NOT NULL,
	`width` integer,
	`height` integer,
	`bytes` integer NOT NULL,
	`format` text NOT NULL,
	`lqip` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assets_path_unique` ON `assets` (`path`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`action` text NOT NULL,
	`detail` text,
	`ip_hash` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_slug` text NOT NULL,
	`parent_id` integer,
	`author_name` text NOT NULL,
	`author_email_hash` text NOT NULL,
	`author_site` text,
	`body_md` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`ip_hash` text NOT NULL,
	`ua` text,
	`notify` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`post_slug`) REFERENCES `posts`(`slug`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_comments_queue` ON `comments` (`post_slug`,`state`,`created_at`);--> statement-breakpoint
CREATE TABLE `friends` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`avatar` text,
	`desc` text,
	`sort` integer DEFAULT 0 NOT NULL,
	`state` text DEFAULT 'ok' NOT NULL,
	`checked_at` integer
);
--> statement-breakpoint
CREATE TABLE `moments_meta` (
	`id` text PRIMARY KEY NOT NULL,
	`likes_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`slug` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_at` integer,
	`pinned` integer DEFAULT false NOT NULL,
	`likes_count` integer DEFAULT 0 NOT NULL,
	`views_count` integer DEFAULT 0 NOT NULL,
	`comments_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_slug` text NOT NULL,
	`visitor_hash` text NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`post_slug`) REFERENCES `posts`(`slug`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_reactions_visitor` ON `reactions` (`post_slug`,`visitor_hash`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `site` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `views_daily` (
	`post_slug` text NOT NULL,
	`date` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`post_slug`, `date`)
);
--> statement-breakpoint
CREATE TABLE `webauthn_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`public_key` text NOT NULL,
	`counter` integer DEFAULT 0 NOT NULL,
	`transports` text
);
