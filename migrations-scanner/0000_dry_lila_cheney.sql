CREATE TABLE "tracked_repos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"repo" text NOT NULL,
	"last_seen_tag" text NOT NULL,
	"checked_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tracked_repos_repo_unique" UNIQUE("repo")
);
