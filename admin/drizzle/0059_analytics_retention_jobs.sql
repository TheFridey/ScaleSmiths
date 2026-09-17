UPDATE "client_analytics_configs"
SET "retention_days" = 395
WHERE "retention_days" < 30 OR "retention_days" > 730;--> statement-breakpoint
ALTER TABLE "client_analytics_configs"
  ADD CONSTRAINT "client_analytics_configs_retention_days_check"
  CHECK ("retention_days" BETWEEN 30 AND 730);--> statement-breakpoint
CREATE TABLE "analytics_retention_job_state" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"lease_owner" text,
	"lease_expires_at" timestamp with time zone,
	"cursor_client_id" integer DEFAULT 0 NOT NULL,
	"last_started_at" timestamp with time zone,
	"last_finished_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_failure_at" timestamp with time zone,
	"last_status" text,
	"last_error_category" text,
	"last_tenants_scanned" integer DEFAULT 0 NOT NULL,
	"last_tenants_failed" integer DEFAULT 0 NOT NULL,
	"last_metrics_deleted" integer DEFAULT 0 NOT NULL,
	"last_audits_deleted" integer DEFAULT 0 NOT NULL,
	"last_credentials_cleared" integer DEFAULT 0 NOT NULL,
	"last_proposals_deleted" integer DEFAULT 0 NOT NULL,
	"last_batches" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analytics_retention_job_state_singleton" CHECK ("id" = 1),
	CONSTRAINT "analytics_retention_job_state_status_check" CHECK ("last_status" IS NULL OR "last_status" IN ('success','failure','partial','running','skipped'))
);--> statement-breakpoint
INSERT INTO "analytics_retention_job_state" ("id") VALUES (1);--> statement-breakpoint
CREATE INDEX "analytics_retention_job_state_lease_idx" ON "analytics_retention_job_state" USING btree ("lease_expires_at");
