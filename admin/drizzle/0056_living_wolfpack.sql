CREATE TYPE "public"."delivery_onboarding_item_kind" AS ENUM('task', 'client_input', 'document_request', 'internal_check');--> statement-breakpoint
CREATE TYPE "public"."delivery_onboarding_item_status" AS ENUM('not_started', 'in_progress', 'blocked', 'completed', 'not_required');--> statement-breakpoint
CREATE TABLE "delivery_onboarding_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"milestone_id" integer,
	"kind" "delivery_onboarding_item_kind" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "delivery_onboarding_item_status" DEFAULT 'not_started' NOT NULL,
	"client_visible" boolean DEFAULT false NOT NULL,
	"owner_user_id" uuid,
	"blocker" text,
	"next_action" text,
	"target_date" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_onboarding_items_position_check" CHECK ("delivery_onboarding_items"."position" >= 0),
	CONSTRAINT "delivery_onboarding_items_blocker_check" CHECK ("delivery_onboarding_items"."status" <> 'blocked' or "delivery_onboarding_items"."blocker" is not null),
	CONSTRAINT "delivery_onboarding_items_completion_check" CHECK (("delivery_onboarding_items"."status" = 'completed' and "delivery_onboarding_items"."completed_at" is not null) or ("delivery_onboarding_items"."status" <> 'completed' and "delivery_onboarding_items"."completed_at" is null))
);
--> statement-breakpoint
ALTER TABLE "delivery_projects" ADD COLUMN "onboarding_template_key" text;--> statement-breakpoint
ALTER TABLE "delivery_projects" ADD COLUMN "onboarding_template_version" integer;--> statement-breakpoint
ALTER TABLE "delivery_projects" ADD COLUMN "onboarding_template_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "delivery_projects" ADD COLUMN "portal_welcome_title" text;--> statement-breakpoint
ALTER TABLE "delivery_projects" ADD COLUMN "portal_welcome_content" text;--> statement-breakpoint
ALTER TABLE "delivery_onboarding_items" ADD CONSTRAINT "delivery_onboarding_items_project_id_delivery_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."delivery_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_onboarding_items" ADD CONSTRAINT "delivery_onboarding_items_milestone_id_delivery_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."delivery_milestones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_onboarding_items" ADD CONSTRAINT "delivery_onboarding_items_owner_user_id_admin_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "delivery_onboarding_items_project_position_idx" ON "delivery_onboarding_items" USING btree ("project_id","position");--> statement-breakpoint
CREATE INDEX "delivery_onboarding_items_project_status_idx" ON "delivery_onboarding_items" USING btree ("project_id","status");