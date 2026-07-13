CREATE TABLE "forge_provider_health" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"event" text NOT NULL,
	"from_state" text,
	"to_state" text,
	"category" text,
	"detail" text,
	"model" text,
	"project_id" integer,
	"task_id" integer,
	"actor" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "forge_provider_health" ADD CONSTRAINT "forge_provider_health_project_id_forge_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."forge_projects"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "forge_provider_health" ADD CONSTRAINT "forge_provider_health_task_id_forge_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."forge_tasks"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "forge_provider_health_provider_idx" ON "forge_provider_health" USING btree ("provider");
--> statement-breakpoint
CREATE INDEX "forge_provider_health_created_at_idx" ON "forge_provider_health" USING btree ("created_at");
