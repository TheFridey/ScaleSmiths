CREATE TYPE "public"."delivery_client_status" AS ENUM('planning', 'build_in_progress', 'quality_checks', 'ready_for_review', 'changes_requested', 'preparing_launch', 'deployed', 'on_hold');--> statement-breakpoint
ALTER TABLE "delivery_projects" ADD COLUMN "client_status" "delivery_client_status" DEFAULT 'planning' NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_projects" ADD COLUMN "client_next_step" text;--> statement-breakpoint
ALTER TABLE "delivery_projects" ADD COLUMN "client_staging_url" text;--> statement-breakpoint
ALTER TABLE "delivery_projects" ADD COLUMN "client_staging_visible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_projects" ADD CONSTRAINT "delivery_projects_client_staging_check" CHECK ("client_staging_visible" = false or "client_staging_url" is not null);--> statement-breakpoint
CREATE TABLE "delivery_forge_integrations" (
	"project_id" integer PRIMARY KEY NOT NULL,
	"forge_project_id" integer NOT NULL,
	"latest_run_id" integer,
	"deployment_candidate_id" integer,
	"internal_release_id" text,
	"staging_deployment_id" text,
	"production_deployment_id" text,
	"internal_build_status" text,
	"internal_qa_status" text,
	"internal_deployment_status" text,
	"last_internal_event_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "delivery_forge_integrations" ADD CONSTRAINT "delivery_forge_integrations_project_id_delivery_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."delivery_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_forge_integrations" ADD CONSTRAINT "delivery_forge_integrations_forge_project_id_forge_projects_id_fk" FOREIGN KEY ("forge_project_id") REFERENCES "public"."forge_projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_forge_integrations" ADD CONSTRAINT "delivery_forge_integrations_latest_run_id_forge_runs_id_fk" FOREIGN KEY ("latest_run_id") REFERENCES "public"."forge_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_forge_integrations" ADD CONSTRAINT "delivery_forge_integrations_deployment_candidate_id_forge_deployment_candidates_id_fk" FOREIGN KEY ("deployment_candidate_id") REFERENCES "public"."forge_deployment_candidates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_forge_integrations_forge_project_idx" ON "delivery_forge_integrations" USING btree ("forge_project_id");--> statement-breakpoint
CREATE INDEX "delivery_forge_integrations_run_idx" ON "delivery_forge_integrations" USING btree ("latest_run_id");--> statement-breakpoint
CREATE INDEX "delivery_forge_integrations_candidate_idx" ON "delivery_forge_integrations" USING btree ("deployment_candidate_id");--> statement-breakpoint
INSERT INTO "delivery_forge_integrations" ("project_id", "forge_project_id", "deployment_candidate_id", "created_at", "updated_at") SELECT "id", "forge_project_id", "deployment_candidate_id", now(), now() FROM "delivery_projects" WHERE "forge_project_id" IS NOT NULL;
