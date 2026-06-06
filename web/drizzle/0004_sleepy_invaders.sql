CREATE TABLE IF NOT EXISTS "login_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "email_delivery_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "email_failure_reason" text;
