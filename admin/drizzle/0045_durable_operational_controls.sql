-- Durable operational controls: leased Forge jobs, shared rate-limit counters,
-- and preview ownership. Hand-written and idempotent to match the repository's
-- migration convention (the drizzle snapshot chain is intentionally not the
-- source of truth here).

-- ── forge_jobs: lease, heartbeat, retry, idempotency, scheduling, task link ──
ALTER TABLE "forge_jobs" ADD COLUMN IF NOT EXISTS "task_id" integer;--> statement-breakpoint
ALTER TABLE "forge_jobs" ADD COLUMN IF NOT EXISTS "failure_reason" text;--> statement-breakpoint
ALTER TABLE "forge_jobs" ADD COLUMN IF NOT EXISTS "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "forge_jobs" ADD COLUMN IF NOT EXISTS "max_attempts" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "forge_jobs" ADD COLUMN IF NOT EXISTS "lease_owner" text;--> statement-breakpoint
ALTER TABLE "forge_jobs" ADD COLUMN IF NOT EXISTS "lease_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "forge_jobs" ADD COLUMN IF NOT EXISTS "heartbeat_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "forge_jobs" ADD COLUMN IF NOT EXISTS "scheduled_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "forge_jobs" ADD CONSTRAINT "forge_jobs_task_id_forge_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."forge_tasks"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "forge_jobs_status_scheduled_at_idx" ON "forge_jobs" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_jobs_lease_expires_at_idx" ON "forge_jobs" USING btree ("lease_expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "forge_jobs_idempotency_key_key" ON "forge_jobs" USING btree ("idempotency_key");--> statement-breakpoint

-- ── rate_limit_counters: durable shared fixed-window counters ──
CREATE TABLE IF NOT EXISTS "rate_limit_counters" (
  "key" text NOT NULL,
  "window_start" timestamp with time zone NOT NULL,
  "count" integer DEFAULT 0 NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  CONSTRAINT "rate_limit_counters_key_window_start_pk" PRIMARY KEY("key","window_start")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rate_limit_counters_expires_at_idx" ON "rate_limit_counters" USING btree ("expires_at");--> statement-breakpoint

-- ── forge_previews: durable preview ownership and lifecycle ──
CREATE TABLE IF NOT EXISTS "forge_previews" (
  "project_id" integer PRIMARY KEY NOT NULL,
  "status" text DEFAULT 'stopped' NOT NULL,
  "owner" text,
  "lease_expires_at" timestamp with time zone,
  "heartbeat_at" timestamp with time zone,
  "method" text,
  "url" text,
  "host" text,
  "port" integer,
  "pid" integer,
  "container_id" text,
  "workspace_path" text,
  "started_at" timestamp with time zone,
  "stopped_at" timestamp with time zone,
  "error" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "forge_previews" ADD CONSTRAINT "forge_previews_project_id_forge_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."forge_projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "forge_previews_lease_expires_at_idx" ON "forge_previews" USING btree ("lease_expires_at");
