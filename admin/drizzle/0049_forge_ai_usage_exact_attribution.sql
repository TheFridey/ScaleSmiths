-- Exact Forge AI cost attribution.
--
-- Links each AI usage row to the run, run step and job that produced it so run and step
-- costs are summed by relationship instead of by overlapping time window.
--
-- Relationships are nullable and are NOT back-filled. Rows written before this migration
-- stay unattributed; inferring linkage from timestamps would reproduce the misattribution
-- this migration exists to remove. ON DELETE SET NULL keeps the spend record when a run,
-- step or job is deleted.
ALTER TABLE "forge_ai_usage" ADD COLUMN IF NOT EXISTS "run_id" integer;--> statement-breakpoint
ALTER TABLE "forge_ai_usage" ADD COLUMN IF NOT EXISTS "run_step_id" integer;--> statement-breakpoint
ALTER TABLE "forge_ai_usage" ADD COLUMN IF NOT EXISTS "job_id" integer;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "forge_ai_usage"
    ADD CONSTRAINT "forge_ai_usage_run_id_fk"
    FOREIGN KEY ("run_id") REFERENCES "forge_runs"("id") ON DELETE set null;
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN duplicate_table THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "forge_ai_usage"
    ADD CONSTRAINT "forge_ai_usage_run_step_id_fk"
    FOREIGN KEY ("run_step_id") REFERENCES "forge_run_steps"("id") ON DELETE set null;
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN duplicate_table THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "forge_ai_usage"
    ADD CONSTRAINT "forge_ai_usage_job_id_fk"
    FOREIGN KEY ("job_id") REFERENCES "forge_jobs"("id") ON DELETE set null;
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN duplicate_table THEN null;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "forge_ai_usage_run_id_idx" ON "forge_ai_usage" ("run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_ai_usage_run_step_id_idx" ON "forge_ai_usage" ("run_step_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_ai_usage_job_id_idx" ON "forge_ai_usage" ("job_id");--> statement-breakpoint

-- Entry-level index that supports project budget and dashboard reads filtering and ordering by completion.
CREATE INDEX IF NOT EXISTS "forge_ai_usage_project_completed_at_idx" ON "forge_ai_usage" ("project_id","completed_at");
