CREATE TYPE "public"."operating_brief_action_status" AS ENUM('dismissed', 'completed', 'snoozed');--> statement-breakpoint
CREATE TABLE "operating_brief_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"recommendation_key" text NOT NULL,
	"evidence_hash" text NOT NULL,
	"status" "operating_brief_action_status" NOT NULL,
	"reason" text,
	"snoozed_until" timestamp with time zone,
	"actor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "operating_brief_actions_key_idx" ON "operating_brief_actions" USING btree ("recommendation_key","evidence_hash");--> statement-breakpoint
CREATE INDEX "operating_brief_actions_status_idx" ON "operating_brief_actions" USING btree ("status","snoozed_until");
