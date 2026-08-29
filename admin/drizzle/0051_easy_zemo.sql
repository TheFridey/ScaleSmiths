CREATE TYPE "public"."delivery_decision_status" AS ENUM('open', 'resolved', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."delivery_deliverable_status" AS ENUM('planned', 'in_progress', 'in_review', 'approved', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."delivery_milestone_status" AS ENUM('planned', 'active', 'blocked', 'completed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."delivery_project_phase" AS ENUM('discovery', 'strategy', 'design', 'build', 'review', 'launch', 'ongoing');--> statement-breakpoint
CREATE TYPE "public"."delivery_project_status" AS ENUM('active', 'paused', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."delivery_resource_kind" AS ENUM('file', 'link');--> statement-breakpoint
CREATE TABLE "delivery_decisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"milestone_id" integer,
	"title" text NOT NULL,
	"description" text,
	"internal_notes" text,
	"status" "delivery_decision_status" DEFAULT 'open' NOT NULL,
	"client_visible" boolean DEFAULT true NOT NULL,
	"requested_from" text,
	"target_date" timestamp with time zone,
	"resolution" text,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_decisions_resolution_check" CHECK (("delivery_decisions"."status" = 'resolved' and "delivery_decisions"."resolved_at" is not null and "delivery_decisions"."resolution" is not null) or ("delivery_decisions"."status" <> 'resolved' and "delivery_decisions"."resolved_at" is null))
);
--> statement-breakpoint
CREATE TABLE "delivery_deliverables" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"milestone_id" integer,
	"title" text NOT NULL,
	"description" text,
	"internal_notes" text,
	"status" "delivery_deliverable_status" DEFAULT 'planned' NOT NULL,
	"client_visible" boolean DEFAULT false NOT NULL,
	"owner_user_id" uuid,
	"target_date" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_deliverables_position_check" CHECK ("delivery_deliverables"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "delivery_milestones" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"internal_notes" text,
	"status" "delivery_milestone_status" DEFAULT 'planned' NOT NULL,
	"client_visible" boolean DEFAULT false NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"target_date" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_milestones_weight_check" CHECK ("delivery_milestones"."weight" > 0),
	CONSTRAINT "delivery_milestones_position_check" CHECK ("delivery_milestones"."position" >= 0),
	CONSTRAINT "delivery_milestones_completion_check" CHECK (("delivery_milestones"."status" = 'completed' and "delivery_milestones"."completed_at" is not null) or ("delivery_milestones"."status" <> 'completed' and "delivery_milestones"."completed_at" is null))
);
--> statement-breakpoint
CREATE TABLE "delivery_project_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"name" text NOT NULL,
	"summary" text,
	"internal_notes" text,
	"client_visible" boolean DEFAULT false NOT NULL,
	"status" "delivery_project_status" DEFAULT 'active' NOT NULL,
	"current_phase" "delivery_project_phase" DEFAULT 'discovery' NOT NULL,
	"owner_user_id" uuid,
	"target_start_date" timestamp with time zone,
	"target_end_date" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"forge_project_id" integer,
	"deployment_candidate_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_projects_dates_check" CHECK ("delivery_projects"."target_end_date" is null or "delivery_projects"."target_start_date" is null or "delivery_projects"."target_end_date" >= "delivery_projects"."target_start_date"),
	CONSTRAINT "delivery_projects_completion_check" CHECK (("delivery_projects"."status" = 'completed' and "delivery_projects"."completed_at" is not null) or ("delivery_projects"."status" <> 'completed' and "delivery_projects"."completed_at" is null))
);
--> statement-breakpoint
CREATE TABLE "delivery_resources" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"deliverable_id" integer,
	"kind" "delivery_resource_kind" NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"visibility" "request_message_visibility" DEFAULT 'internal' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "delivery_decisions" ADD CONSTRAINT "delivery_decisions_project_id_delivery_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."delivery_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_decisions" ADD CONSTRAINT "delivery_decisions_milestone_id_delivery_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."delivery_milestones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_decisions" ADD CONSTRAINT "delivery_decisions_resolved_by_admin_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_deliverables" ADD CONSTRAINT "delivery_deliverables_project_id_delivery_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."delivery_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_deliverables" ADD CONSTRAINT "delivery_deliverables_milestone_id_delivery_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."delivery_milestones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_deliverables" ADD CONSTRAINT "delivery_deliverables_owner_user_id_admin_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_milestones" ADD CONSTRAINT "delivery_milestones_project_id_delivery_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."delivery_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_project_audit_logs" ADD CONSTRAINT "delivery_project_audit_logs_project_id_delivery_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."delivery_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_project_audit_logs" ADD CONSTRAINT "delivery_project_audit_logs_actor_user_id_admin_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_projects" ADD CONSTRAINT "delivery_projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_projects" ADD CONSTRAINT "delivery_projects_owner_user_id_admin_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_projects" ADD CONSTRAINT "delivery_projects_forge_project_id_forge_projects_id_fk" FOREIGN KEY ("forge_project_id") REFERENCES "public"."forge_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_projects" ADD CONSTRAINT "delivery_projects_deployment_candidate_id_forge_deployment_candidates_id_fk" FOREIGN KEY ("deployment_candidate_id") REFERENCES "public"."forge_deployment_candidates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_resources" ADD CONSTRAINT "delivery_resources_project_id_delivery_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."delivery_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_resources" ADD CONSTRAINT "delivery_resources_deliverable_id_delivery_deliverables_id_fk" FOREIGN KEY ("deliverable_id") REFERENCES "public"."delivery_deliverables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_resources" ADD CONSTRAINT "delivery_resources_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "delivery_decisions_project_status_idx" ON "delivery_decisions" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "delivery_deliverables_project_position_idx" ON "delivery_deliverables" USING btree ("project_id","position");--> statement-breakpoint
CREATE INDEX "delivery_deliverables_milestone_idx" ON "delivery_deliverables" USING btree ("milestone_id");--> statement-breakpoint
CREATE INDEX "delivery_milestones_project_position_idx" ON "delivery_milestones" USING btree ("project_id","position");--> statement-breakpoint
CREATE INDEX "delivery_milestones_project_visibility_idx" ON "delivery_milestones" USING btree ("project_id","client_visible");--> statement-breakpoint
CREATE INDEX "delivery_project_audit_project_idx" ON "delivery_project_audit_logs" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "delivery_projects_client_status_idx" ON "delivery_projects" USING btree ("client_id","status");--> statement-breakpoint
CREATE INDEX "delivery_projects_owner_status_idx" ON "delivery_projects" USING btree ("owner_user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_projects_forge_project_idx" ON "delivery_projects" USING btree ("forge_project_id");--> statement-breakpoint
CREATE INDEX "delivery_resources_project_created_idx" ON "delivery_resources" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "delivery_resources_deliverable_idx" ON "delivery_resources" USING btree ("deliverable_id");--> statement-breakpoint
CREATE VIEW "delivery_project_progress" AS
SELECT
  p.id AS project_id,
  COALESCE(
    ROUND(
      100.0 * COALESCE(SUM(m.weight) FILTER (WHERE m.status = 'completed'), 0)
      / NULLIF(SUM(m.weight) FILTER (WHERE m.status <> 'skipped'), 0)
    ),
    0
  )::integer AS progress
FROM delivery_projects p
LEFT JOIN delivery_milestones m ON m.project_id = p.id
GROUP BY p.id;
