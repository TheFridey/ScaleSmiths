CREATE TABLE "forge_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"payload_json" jsonb,
	"result_json" jsonb,
	"error" text,
	"actor" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "forge_artifacts" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "forge_artifacts" ADD COLUMN IF NOT EXISTS "superseded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "forge_artifacts" ADD COLUMN IF NOT EXISTS "retention_policy" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "forge_artifacts" ADD COLUMN IF NOT EXISTS "content_bytes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "forge_jobs" ADD CONSTRAINT "forge_jobs_project_id_forge_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."forge_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "forge_jobs_project_id_idx" ON "forge_jobs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "forge_jobs_status_created_at_idx" ON "forge_jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_activity_logs_project_id_idx" ON "forge_activity_logs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_activity_logs_project_created_at_idx" ON "forge_activity_logs" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_activity_logs_action_idx" ON "forge_activity_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_artifacts_project_id_idx" ON "forge_artifacts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_artifacts_project_type_idx" ON "forge_artifacts" USING btree ("project_id","type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_artifacts_project_type_title_idx" ON "forge_artifacts" USING btree ("project_id","type","title");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_artifacts_version_idx" ON "forge_artifacts" USING btree ("project_id","type","title","version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_integration_configs_project_id_idx" ON "forge_integration_configs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_integration_configs_project_provider_idx" ON "forge_integration_configs" USING btree ("project_id","provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_integration_configs_provider_idx" ON "forge_integration_configs" USING btree ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_memories_project_id_idx" ON "forge_memories" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_memories_project_key_idx" ON "forge_memories" USING btree ("project_id","key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_projects_status_idx" ON "forge_projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_projects_priority_idx" ON "forge_projects" USING btree ("priority");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_projects_updated_at_idx" ON "forge_projects" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_tasks_project_id_idx" ON "forge_tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_tasks_project_status_idx" ON "forge_tasks" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_tasks_project_agent_type_idx" ON "forge_tasks" USING btree ("project_id","agent_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forge_tasks_status_updated_at_idx" ON "forge_tasks" USING btree ("status","updated_at");
