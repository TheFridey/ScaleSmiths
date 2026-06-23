CREATE TABLE "forge_ai_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer,
	"task_id" integer,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"estimated_cost" numeric(12, 6) DEFAULT '0' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "forge_ai_usage" ADD CONSTRAINT "forge_ai_usage_project_id_forge_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."forge_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forge_ai_usage" ADD CONSTRAINT "forge_ai_usage_task_id_forge_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."forge_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "forge_ai_usage_project_id_idx" ON "forge_ai_usage" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "forge_ai_usage_task_id_idx" ON "forge_ai_usage" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "forge_ai_usage_completed_at_idx" ON "forge_ai_usage" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "forge_ai_usage_provider_idx" ON "forge_ai_usage" USING btree ("provider");