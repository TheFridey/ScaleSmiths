CREATE TYPE "public"."forge_artifact_type" AS ENUM('research_report', 'sitemap', 'copy_doc', 'design_direction', 'component_spec', 'generated_code', 'qa_report', 'proposal', 'handover_doc', 'deployment_notes');--> statement-breakpoint
CREATE TYPE "public"."forge_integration_provider" AS ENUM('resend', 'whatsapp', 'analytics', 'calendly', 'stripe', 'cloudinary', 'custom');--> statement-breakpoint
CREATE TYPE "public"."forge_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."forge_project_status" AS ENUM('intake', 'research', 'strategy', 'sitemap', 'copy', 'design', 'build', 'qa', 'integrations', 'preview', 'client_review', 'ready_to_deploy', 'deployed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."forge_task_agent_type" AS ENUM('intake', 'research', 'strategy', 'sitemap', 'copy', 'design', 'frontend', 'integration', 'qa', 'deploy', 'repair');--> statement-breakpoint
CREATE TYPE "public"."forge_task_status" AS ENUM('queued', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "forge_activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"actor" text,
	"action" text NOT NULL,
	"message" text NOT NULL,
	"metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forge_artifacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"type" "forge_artifact_type" NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forge_integration_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"provider" "forge_integration_provider" NOT NULL,
	"config_json" jsonb,
	"enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forge_memories" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forge_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"business_name" text NOT NULL,
	"industry" text,
	"website_url" text,
	"status" "forge_project_status" DEFAULT 'intake' NOT NULL,
	"priority" "forge_priority" DEFAULT 'medium' NOT NULL,
	"owner_actor" text,
	"client_id" integer,
	"prospect_id" integer,
	"brand_notes" text,
	"target_audience" text,
	"primary_goal" text,
	"budget_range" text,
	"deadline" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forge_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"agent_type" "forge_task_agent_type" NOT NULL,
	"status" "forge_task_status" DEFAULT 'queued' NOT NULL,
	"input_json" jsonb,
	"output_json" jsonb,
	"error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "forge_activity_logs" ADD CONSTRAINT "forge_activity_logs_project_id_forge_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."forge_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forge_artifacts" ADD CONSTRAINT "forge_artifacts_project_id_forge_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."forge_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forge_integration_configs" ADD CONSTRAINT "forge_integration_configs_project_id_forge_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."forge_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forge_memories" ADD CONSTRAINT "forge_memories_project_id_forge_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."forge_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forge_projects" ADD CONSTRAINT "forge_projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forge_projects" ADD CONSTRAINT "forge_projects_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forge_tasks" ADD CONSTRAINT "forge_tasks_project_id_forge_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."forge_projects"("id") ON DELETE cascade ON UPDATE no action;
