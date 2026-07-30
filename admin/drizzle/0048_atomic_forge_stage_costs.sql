-- Per-stage cost governance for atomic Forge Run execution.
ALTER TABLE "forge_run_steps" ADD COLUMN IF NOT EXISTS "estimated_cost_usd" numeric(12,6) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "forge_run_steps" ADD COLUMN IF NOT EXISTS "actual_cost_usd" numeric(12,6) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "forge_run_steps" ADD COLUMN IF NOT EXISTS "estimated_retry_cost_usd" numeric(12,6) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "forge_run_steps" ADD COLUMN IF NOT EXISTS "remaining_estimated_cost_usd" numeric(12,6) DEFAULT '0' NOT NULL;
