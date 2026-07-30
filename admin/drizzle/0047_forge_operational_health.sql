-- Unified, redacted operator-facing failure records for durable jobs and run steps.
ALTER TABLE "forge_jobs" ADD COLUMN IF NOT EXISTS "operator_error_json" jsonb;--> statement-breakpoint
ALTER TABLE "forge_run_steps" ADD COLUMN IF NOT EXISTS "operator_error_json" jsonb;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_jobs_operator_error_category_idx" ON "forge_jobs" (("operator_error_json"->>'category')) WHERE "operator_error_json" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_run_steps_operator_error_category_idx" ON "forge_run_steps" (("operator_error_json"->>'category')) WHERE "operator_error_json" IS NOT NULL;
