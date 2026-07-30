CREATE TABLE IF NOT EXISTS "forge_runs" (
  "id" serial PRIMARY KEY NOT NULL,
  "project_id" integer NOT NULL REFERENCES "forge_projects"("id") ON DELETE cascade,
  "mode" text DEFAULT 'standard' NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "current_stage" text,
  "policy_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "started_by" text NOT NULL,
  "started_at" timestamp with time zone,
  "paused_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "pause_reason" text,
  "estimated_cost_usd" numeric(12,6) DEFAULT '0' NOT NULL,
  "actual_cost_usd" numeric(12,6) DEFAULT '0' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "forge_runs_status_check" CHECK ("status" IN ('draft','running','paused','completed','failed','cancelled'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_runs_project_created_at_idx" ON "forge_runs" ("project_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_runs_project_status_idx" ON "forge_runs" ("project_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_runs_status_updated_at_idx" ON "forge_runs" ("status","updated_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "forge_runs_one_active_project_idx" ON "forge_runs" ("project_id") WHERE "status" IN ('draft','running','paused');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "forge_run_steps" (
  "id" serial PRIMARY KEY NOT NULL,
  "run_id" integer NOT NULL REFERENCES "forge_runs"("id") ON DELETE cascade,
  "project_id" integer NOT NULL REFERENCES "forge_projects"("id") ON DELETE cascade,
  "stage" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "sequence" integer NOT NULL,
  "required" boolean DEFAULT true NOT NULL,
  "input_hash" text,
  "output_artifact_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "job_id" integer REFERENCES "forge_jobs"("id") ON DELETE set null,
  "task_id" integer REFERENCES "forge_tasks"("id") ON DELETE set null,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 3 NOT NULL,
  "approval_required" boolean DEFAULT false NOT NULL,
  "approved_by" text,
  "approved_at" timestamp with time zone,
  "failure_category" text,
  "failure_message" text,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "forge_run_steps_status_check" CHECK ("status" IN ('pending','queued','running','awaiting_approval','completed','failed','skipped','cancelled','blocked'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "forge_run_steps_run_stage_idx" ON "forge_run_steps" ("run_id","stage");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "forge_run_steps_job_idx" ON "forge_run_steps" ("job_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_run_steps_run_sequence_idx" ON "forge_run_steps" ("run_id","sequence");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_run_steps_project_status_idx" ON "forge_run_steps" ("project_id","status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "forge_run_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "run_id" integer NOT NULL REFERENCES "forge_runs"("id") ON DELETE cascade,
  "step_id" integer REFERENCES "forge_run_steps"("id") ON DELETE set null,
  "event_type" text NOT NULL,
  "actor" text NOT NULL,
  "message" text NOT NULL,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_run_events_run_created_at_idx" ON "forge_run_events" ("run_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_run_events_step_created_at_idx" ON "forge_run_events" ("step_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_run_events_type_idx" ON "forge_run_events" ("event_type");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "forge_worker_heartbeats" (
  "worker_id" text PRIMARY KEY NOT NULL,
  "process_id" integer NOT NULL,
  "hostname" text NOT NULL,
  "last_heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL,
  "active_job_count" integer DEFAULT 0 NOT NULL,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_worker_heartbeats_last_seen_idx" ON "forge_worker_heartbeats" ("last_heartbeat_at");
