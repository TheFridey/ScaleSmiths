CREATE TABLE IF NOT EXISTS "web_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_rate_limits_reset_at_idx" ON "web_rate_limits" USING btree ("reset_at");
